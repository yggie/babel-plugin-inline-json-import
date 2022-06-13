import type {
  ImportDeclaration,
  ImportSpecifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  VariableDeclarator,
  StringLiteral,
  CallExpression,
  ObjectPattern,
  ObjectProperty,
  Identifier,
  ArrayPattern,
  RestElement,
} from '@babel/types'

export type FullyDestructuredImportDeclaration = Omit<ImportDeclaration, 'specifiers'> & {
  specifiers: ImportSpecifier[]
}

export type DefaultOnlyImportDeclaration = Omit<ImportDeclaration, 'specifiers'> & {
  specifiers: [ImportDefaultSpecifier]
}

export type NamespaceOnlyImportDeclaration = Omit<ImportDeclaration, 'specifiers'> & {
  specifiers: [ImportNamespaceSpecifier]
}

export type MixedNamespaceImportDeclaration = Omit<ImportDeclaration, 'specifiers'> & {
  specifiers: [ImportDefaultSpecifier, ...ImportNamespaceSpecifier[]]
}

export type MixedNamedImportDeclaration = Omit<ImportDeclaration, 'specifiers'> & {
  specifiers: [ImportDefaultSpecifier, ...ImportSpecifier[]]
}

export type JsonRequireCall = Omit<VariableDeclarator, 'init'> & {
  init: Omit<CallExpression, 'arguments'> & {arguments: StringLiteral[]}
}

export type SimpleObjectProperty = Omit<ObjectProperty, 'key' | 'value'> & {
  key: Identifier
  value: Identifier
}

export type FullyDestructuredJsonRequireCall = Omit<JsonRequireCall, 'id'> & {
  id: Omit<ObjectPattern, 'properties'> & {properties: SimpleObjectProperty[]}
}

export type DestructuredArrayJsonRequireCall = Omit<JsonRequireCall, 'id'> & {
  id: Omit<ArrayPattern, 'elements'> & {elements: (null | Identifier | RestElement)[]}
}
