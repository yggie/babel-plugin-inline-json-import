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

          if (moduleName.match(/\.json$/)) {
            var variableName = node.specifiers[0].local.name;

            var fileLocation = state.file.opts.filename;
            var filepath = null;

            if (fileLocation === 'unknown') {
              filepath = moduleName;
            } else {
              filepath = _path2.default.join(_path2.default.resolve(fileLocation), '..', moduleName);
            }

            var json = requireFresh(filepath);

            path.replaceWith(t.variableDeclaration('const', [t.variableDeclarator(t.identifier(variableName), t.valueToNode(json))]));
          }
        }
      }
    }
  };
}

function requireFresh(filepath) {
  (0, _decache2.default)(filepath);

  return require(filepath);
}