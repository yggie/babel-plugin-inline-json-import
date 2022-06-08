import {readFileSync} from 'node:fs'
import {dirname as getParentDir, resolve as resolvePath} from 'node:path'
import type {PluginPass} from '@babel/core'
import type * as BabelTypes from '@babel/types'
import type {Visitor} from '@babel/traverse'
import type {
  DefaultOnlyImportDeclaration,
  DestructuredArrayJsonRequireCall,
  FullyDestructuredImportDeclaration,
  FullyDestructuredJsonRequireCall,
  JsonRequireCall,
  MixedNamedImportDeclaration,
  MixedNamespaceImportDeclaration,
  NamespaceOnlyImportDeclaration,
  SimpleObjectProperty,
} from './types'

interface Babel {
  types: typeof BabelTypes
}

interface PluginOptions {
  match?: string | RegExp
  matchFlags?: string
}

interface PluginScope extends Omit<PluginPass, 'opts'> {
  opts?: PluginOptions
  filename?: string
}

const DEFAULT_MATCHER = /\.json$/i

export = function babelPluginInlineJsonImports({types: t}: Babel): {
  visitor: Visitor<PluginScope>
} {
  return {
    visitor: {
      ImportDeclaration: {
        exit(path, state) {
          const {node} = path
          const moduleName = node.source.value
          const filenameMatcher = getMatcher(state)
          if (!filenameMatcher.test(moduleName)) {
            return
          }

          const json = loadJsonFile(moduleName, state)

          // ex: `import pkg from '../package.json'`
          // --- OR ---
          // ex: `import * as pkg from '../package.json'`
          if (
            isDefaultOnlyImportDeclaration(t, node) ||
            isNamespaceOnlyImportDeclaration(t, node)
          ) {
            const variableName = node.specifiers[0].local.name
            path.replaceWith(
              t.variableDeclaration('const', [
                t.variableDeclarator(t.identifier(variableName), t.valueToNode(json)),
              ])
            )
            return
          }

          // ex: `import {foo, bar} from './someFile.json'`
          // ex: `import {foo as bar} from './someFile.json'`
          if (isDestructuredImportDeclaration(t, node)) {
            if (!isRecord(json)) {
              throw new Error(
                `Attempting to destructure from non-object JSON module "${moduleName}"`
              )
            }

            path.replaceWithMultiple(
              buildVariableDeclarationsFromDestructuredImports(t, node, json)
            )
            return
          }

          // ex: `import allOfIt, * as TheJsonData from './data.json'`
          if (isMixedNamespaceImportExpression(t, node)) {
            path.replaceWithMultiple(buildMixedNamespaceImport(t, node, json))
            return
          }

          // ex: `import allOfIt, {someOfIt} from './data.json'`
          if (isMixedNamedImportExpression(t, node)) {
            if (!isRecord(json)) {
              throw new Error(
                `Attempting to destructure from non-object JSON module "${moduleName}"`
              )
            }

            path.replaceWithMultiple(buildMixedNamedImport(t, node, json))
            return
          }
        },
      },

      VariableDeclaration: {
        exit(path, state) {
          const {node} = path

          let changed = false
          const newDeclarators = node.declarations.flatMap((declaration) => {
            if (!isJsonRequireCall(t, declaration)) {
              return declaration
            }

            const jsonPath = declaration.init.arguments[0].value
            const filenameMatcher = getMatcher(state)
            if (!filenameMatcher.test(jsonPath)) {
              return declaration
            }

            const json = loadJsonFile(jsonPath, state)

            if (t.isIdentifier(declaration.id)) {
              changed = true
              return t.variableDeclarator(declaration.id, t.valueToNode(json))
            }

            // This is for _simple_ destructuring only, currently. In other words:
            // ex: `const {foo, bar} = require('./someJson.json')`
            if (isDestructuredRequireDeclaration(t, declaration)) {
              if (!isRecord(json)) {
                throw new Error(
                  `Attempting to destructure from non-object JSON module "${jsonPath}"`
                )
              }

              changed = true
              return declaration.id.properties.map((prop) =>
                t.variableDeclarator(prop.value, t.valueToNode(json[prop.key.name]))
              )
            }

            // ex: const [first, , third, ...rest] = require('./someArray.json')
            // ex: const [firstChar] = require('./someString.json')
            if (isDestructuredArrayRequireDeclaration(t, declaration)) {
              if (!Array.isArray(json) && typeof json !== 'string') {
                throw new Error(
                  `Attempting to positionally destructure from non-array/string JSON module "${jsonPath}"`
                )
              }

              changed = true
              return declaration.id.elements
                .map((el, index) => {
                  if (el === null) {
                    return null
                  }

                  if (t.isIdentifier(el)) {
                    return t.variableDeclarator(el, t.valueToNode(json[index]))
                  }

                  if (!t.isIdentifier(el.argument)) {
                    throw new Error('Unrecognized rest spread argument')
                  }

                  return t.variableDeclarator(el.argument, t.valueToNode(json.slice(index)))
                })
                .filter((el): el is BabelTypes.VariableDeclarator => el !== null)
            }

            return declaration
          })

          if (changed) {
            path.replaceWith(t.variableDeclaration(node.kind, newDeclarators))
          }
        },
      },
    },
  }
}

function isJsonRequireCall(
  t: typeof BabelTypes,
  decl: BabelTypes.VariableDeclarator
): decl is JsonRequireCall {
  const init = decl.init
  return (
    t.isCallExpression(init) &&
    t.isIdentifier(init.callee) &&
    init.callee.name === 'require' &&
    init.arguments.length === 1 &&
    t.isStringLiteral(init.arguments[0])
  )
}

function isMixedNamespaceImportExpression(
  t: typeof BabelTypes,
  node: BabelTypes.ImportDeclaration
): node is MixedNamespaceImportDeclaration {
  if (node.specifiers.length !== 2) {
    return false
  }

  const hasDefault = t.isImportDefaultSpecifier(node.specifiers[0])
  const hasNamespace = t.isImportNamespaceSpecifier(node.specifiers[1])
  return hasDefault && hasNamespace
}

function isMixedNamedImportExpression(
  t: typeof BabelTypes,
  node: BabelTypes.ImportDeclaration
): node is MixedNamedImportDeclaration {
  if (node.specifiers.length < 2) {
    return false
  }

  const hasDefault = t.isImportDefaultSpecifier(node.specifiers[0])
  const restIsNamed = node.specifiers.slice(1).every((specifier) => t.isImportSpecifier(specifier))

  return hasDefault && restIsNamed
}

function isDefaultOnlyImportDeclaration(
  t: typeof BabelTypes,
  node: BabelTypes.ImportDeclaration
): node is DefaultOnlyImportDeclaration {
  return node.specifiers.length === 1 && t.isImportDefaultSpecifier(node.specifiers[0])
}

function isNamespaceOnlyImportDeclaration(
  t: typeof BabelTypes,
  node: BabelTypes.ImportDeclaration
): node is NamespaceOnlyImportDeclaration {
  return node.specifiers.length === 1 && t.isImportNamespaceSpecifier(node.specifiers[0])
}

function isDestructuredImportDeclaration(
  t: typeof BabelTypes,
  node: BabelTypes.ImportDeclaration
): node is FullyDestructuredImportDeclaration {
  return node.specifiers.every((specifier) => t.isImportSpecifier(specifier))
}

function isDestructuredRequireDeclaration(
  t: typeof BabelTypes,
  node: JsonRequireCall
): node is FullyDestructuredJsonRequireCall {
  return (
    t.isObjectPattern(node.id) &&
    node.id.properties.every((prop) => isSimpleObjectProperty(t, prop))
  )
}

function isDestructuredArrayRequireDeclaration(
  t: typeof BabelTypes,
  node: JsonRequireCall
): node is DestructuredArrayJsonRequireCall {
  if (!t.isArrayPattern(node.id)) {
    return false
  }

  const elements = node.id.elements
  const last = elements[elements.length - 1]
  const lastIsValid = t.isRestElement(last) || t.isIdentifier(last)
  if (!lastIsValid) {
    return false
  }

  if (elements.length === 1) {
    return true
  }

  return elements.slice(0, -1).every((el) => t.isIdentifier(el) || el === null)
}

function isSimpleObjectProperty(
  t: typeof BabelTypes,
  node: BabelTypes.ObjectProperty | BabelTypes.RestElement
): node is SimpleObjectProperty {
  return t.isObjectProperty(node) && t.isIdentifier(node.key) && t.isIdentifier(node.value)
}

function buildVariableDeclarationsFromDestructuredImports(
  t: typeof BabelTypes,
  node: FullyDestructuredImportDeclaration,
  json: Record<string, unknown>
): BabelTypes.VariableDeclaration[] {
  return node.specifiers.map(({imported, local}) => {
    const sourceProp = t.isStringLiteral(imported) ? imported.value : imported.name
    const alias = t.identifier(local.name)
    const value = sourceProp in json ? json[sourceProp] : undefined
    return t.variableDeclaration('const', [t.variableDeclarator(alias, t.valueToNode(value))])
  })
}

function buildMixedNamespaceImport(
  t: typeof BabelTypes,
  node: MixedNamespaceImportDeclaration,
  json: unknown
) {
  const [defaultImport, namespacedImport] = node.specifiers
  return [
    t.variableDeclaration('const', [
      t.variableDeclarator(defaultImport.local, t.valueToNode(json)),
    ]),
    t.variableDeclaration('const', [
      t.variableDeclarator(namespacedImport.local, defaultImport.local),
    ]),
  ]
}

function buildMixedNamedImport(
  t: typeof BabelTypes,
  node: MixedNamedImportDeclaration,
  json: Record<string, unknown>
) {
  const [defaultImport, ...namedImports] = node.specifiers
  return [
    t.variableDeclaration('const', [
      t.variableDeclarator(defaultImport.local, t.valueToNode(json)),
    ]),
    ...namedImports.map((specifier) => {
      return t.variableDeclaration('const', [
        t.variableDeclarator(
          specifier.local,
          t.memberExpression(
            defaultImport.local,
            specifier.imported,
            t.isStringLiteral(specifier.imported)
          )
        ),
      ])
    }),
  ]
}

function loadJsonFile(moduleName: string, state: PluginScope): unknown {
  const {filename} = state
  let filePath = null

  if (typeof filename === 'undefined') {
    filePath = moduleName
  } else {
    filePath = resolvePath(getParentDir(filename), moduleName)
  }

  const content = readFileSync(filePath, 'utf8')
  return JSON.parse(content)
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && !Array.isArray(obj) && obj !== null
}

function getMatcher(state: PluginScope): RegExp {
  const {match, matchFlags} = state.opts || {}
  if (!match) {
    return DEFAULT_MATCHER
  }

  if (match instanceof RegExp) {
    return match
  }

  return match && matchFlags ? new RegExp(match, matchFlags) : new RegExp(match)
}
