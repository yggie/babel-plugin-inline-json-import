'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = babelPluginInlineJsonImports;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _decache = require('decache');

var _decache2 = _interopRequireDefault(_decache);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function babelPluginInlineJsonImports(_ref) {
  var t = _ref.types;

  return {
    visitor: {
      ImportDeclaration: {
        exit: function exit(path, state) {
          var node = path.node;


          var moduleName = node.source.value;

          if (moduleName.match(/\.json(!json)?$/)) {
            var leftExpression = determineLeftExpression(t, node);

            var fileLocation = state.file.opts.filename;
            var filepath = null;

            if (fileLocation === 'unknown') {
              filepath = moduleName;
            } else {
              filepath = _path2.default.join(_path2.default.resolve(fileLocation), '..', moduleName);
            }

            if (filepath.slice(-5) === '!json') {
              filepath = filepath.slice(0, filepath.length - 5);
            }

            var json = requireFresh(filepath);

            path.replaceWith(t.variableDeclaration('const', [t.variableDeclarator(leftExpression, t.valueToNode(json))]));
          }
        }
      }
    }
  };
}

function determineLeftExpression(types, node) {
  if (isDestructuredImportExpression(node)) {
    return buildObjectPatternFromDestructuredImport(types, node);
  }

  var variableName = node.specifiers[0].local.name;

  return types.identifier(variableName);
}

function isDestructuredImportExpression(node) {
  return node.specifiers.length !== 1 || node.specifiers[0].type !== 'ImportDefaultSpecifier';
}

function buildObjectPatternFromDestructuredImport(types, node) {
  var properties = node.specifiers.map(function (specifier) {
    var key = types.identifier(specifier.imported.name);
    var value = types.identifier(specifier.local.name);

    return types.objectProperty(key, value);
  });

  return types.objectPattern(properties);
}

function requireFresh(filepath) {
  (0, _decache2.default)(filepath);

  return require(filepath);
}