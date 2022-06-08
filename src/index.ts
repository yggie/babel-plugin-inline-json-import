import {readFileSync} from 'node:fs'
import {dirname as getParentDir, resolve as resolvePath} from 'node:path'
import type {PluginPass} from '@babel/core'
import type * as BabelTypes from '@babel/types'
import type {Visitor} from '@babel/traverse'
import type {
  DefaultOnlyImportDeclaration,
  FullyDestructuredImportDeclaration,
  JsonRequireCall,
  MixedNamedImportDeclaration,
  MixedNamespaceImportDeclaration,
  NamespaceOnlyImportDeclaration,
} from './types'

interface Babel {
  types: typeof BabelTypes
}

interface PluginOptions {}

const SUPPORTED_MODULES_REGEX = /\.json$/

export = function babelPluginInlineJsonImports({types: t}: Babel): {
  visitor: Visitor<PluginPass>
} {
  return {
    visitor: {
      ImportDeclaration: {
        exit(path, state = {} as any) {
          const {node} = path
          const moduleName = node.source.value
          if (!SUPPORTED_MODULES_REGEX.test(moduleName)) {
            return
          }

          const json = loadJsonFile(moduleName, state)

          // ex: `import pkg from '../package.json'`
          // --- OR ---
          // ex: `import * as pkg from '../package.json'`
          if (isDefaultOnlyImportDeclaration(node) || isNamespaceOnlyImportDeclaration(node)) {
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
          if (isDestructuredImportDeclaration(node)) {
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
          if (isMixedNamespaceImportExpression(node)) {
            path.replaceWithMultiple(buildMixedNamespaceImport(t, node, json))
            return
          }

          // ex: `import allOfIt, {someOfIt} from './data.json'`
          if (isMixedNamedImportExpression(node)) {
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
          const newDeclarators = node.declarations.map((declaration) => {
            if (isJsonRequireCall(declaration)) {
              changed = true

              const {init} = declaration
              const json = loadJsonFile(init.arguments[0].value, state)

              return t.variableDeclarator(declaration.id, t.valueToNode(json))
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

function isJsonRequireCall(decl: BabelTypes.VariableDeclarator): decl is JsonRequireCall {
  const init = decl.init
  return (
    (init || false) &&
    init.type === 'CallExpression' &&
    init.callee.type === 'Identifier' &&
    init.callee.name === 'require' &&
    init.arguments.length === 1 &&
    init.arguments[0].type === 'StringLiteral' &&
    SUPPORTED_MODULES_REGEX.test(init.arguments[0].value)
  )
}

function isMixedNamespaceImportExpression(
  node: BabelTypes.ImportDeclaration
): node is MixedNamespaceImportDeclaration {
  if (node.specifiers.length !== 2) {
    return false
  }

  const hasDefault = node.specifiers[0].type === 'ImportDefaultSpecifier'
  const hasNamespace = node.specifiers[1].type === 'ImportNamespaceSpecifier'
  return hasDefault && hasNamespace
}

function isMixedNamedImportExpression(
  node: BabelTypes.ImportDeclaration
): node is MixedNamedImportDeclaration {
  if (node.specifiers.length < 2) {
    return false
  }

  const hasDefault = node.specifiers[0].type === 'ImportDefaultSpecifier'
  const restIsNamed = node.specifiers
    .slice(1)
    .every((specifier) => specifier.type === 'ImportSpecifier')

  return hasDefault && restIsNamed
}

function isDefaultOnlyImportDeclaration(
  node: BabelTypes.ImportDeclaration
): node is DefaultOnlyImportDeclaration {
  return node.specifiers.length === 1 && node.specifiers[0].type === 'ImportDefaultSpecifier'
}

function isNamespaceOnlyImportDeclaration(
  node: BabelTypes.ImportDeclaration
): node is NamespaceOnlyImportDeclaration {
  return node.specifiers.length === 1 && node.specifiers[0].type === 'ImportNamespaceSpecifier'
}

function isDestructuredImportDeclaration(
  node: BabelTypes.ImportDeclaration
): node is FullyDestructuredImportDeclaration {
  return node.specifiers.every((specifier) => specifier.type === 'ImportSpecifier')
}

function buildVariableDeclarationsFromDestructuredImports(
  t: typeof BabelTypes,
  node: FullyDestructuredImportDeclaration,
  json: Record<string, unknown>
): BabelTypes.VariableDeclaration[] {
  return node.specifiers.map(({imported, local}) => {
    const sourceProp = imported.type === 'StringLiteral' ? imported.value : imported.name
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
            specifier.imported.type === 'StringLiteral'
          )
        ),
      ])
    }),
  ]
}

function loadJsonFile(moduleName: string, state: PluginPass): unknown {
  const {filename: fileLocation} = state
  let filePath = null

  if (typeof fileLocation === 'undefined') {
    filePath = moduleName
  } else {
    filePath = resolvePath(getParentDir(fileLocation), moduleName)
  }

  const content = readFileSync(filePath, 'utf8')
  return JSON.parse(content)
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && !Array.isArray(obj) && obj !== null
}
