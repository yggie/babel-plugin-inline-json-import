import Path from 'path'
import decache from 'decache'

export default function babelPluginInlineJsonImports({ types: t }) {
  return {
    visitor: {
      ImportDeclaration(path, state) {
        const { node } = path

        const moduleName = node.source.value

        if (moduleName.match(/\.json(!json)?$/)) {
          const variableName = node.specifiers[0].local.name

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
                t.identifier(variableName),
                t.valueToNode(json),
              ),
            ])
          )
        }
      },
    },
  }
}

function requireFresh(filepath) {
  decache(filepath)

  return require(filepath)
}
