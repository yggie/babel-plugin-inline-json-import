import type {
  ImportDeclaration,
  ImportSpecifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  VariableDeclarator,
  StringLiteral,
  CallExpression,
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
