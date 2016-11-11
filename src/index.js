import Path from 'path'
import decache from 'decache'

export default function babelPluginInlineJsonImports({ types: t }) {
  return {
    visitor: {
      ImportDeclaration: {
        exit(path, state) {
          const { node } = path

          const moduleName = node.source.value

          if (moduleName.match(/\.json(!json)?$/)) {
            const leftExpression = determineLeftExpression(t, node)

            const fileLocation = state.file.opts.filename
            let filepath = null

            if (fileLocation === 'unknown') {
              filepath = moduleName
            } else {
              filepath = Path.join(Path.resolve(fileLocation), '..', moduleName)
            }

            if (filepath.slice(-5) === '!json') {
              filepath = filepath.slice(0, filepath.length - 5);
            }

            const json = requireFresh(filepath)

            path.replaceWith(
              t.variableDeclaration('const', [
                t.variableDeclarator(
                  leftExpression,
                  t.valueToNode(json),
                ),
              ])
            )
          }
        },
      },
    },
  }
}

function determineLeftExpression(types, node) {
  if (isDestructuredImportExpression(node)) {
    return buildObjectPatternFromDestructuredImport(types, node)
  }

  const variableName = node.specifiers[0].local.name

  return types.identifier(variableName)
}

function isDestructuredImportExpression(node) {
  return node.specifiers.length !== 1 ||
    node.specifiers[0].type !== 'ImportDefaultSpecifier'
}

function buildObjectPatternFromDestructuredImport(types, node) {
  const properties = node.specifiers.map((specifier) => {
    const key = types.identifier(specifier.imported.name)
    const value = types.identifier(specifier.local.name)

    return types.objectProperty(key, value)
  })

  return types.objectPattern(properties)
}

function requireFresh(filepath) {
  decache(filepath)

  return require(filepath)
}
