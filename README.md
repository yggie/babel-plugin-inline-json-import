# babel-plugin-inline-json-import
[![NPM](https://nodei.co/npm/babel-plugin-inline-json-import.png?downloads=true&stars=true)](https://npmjs.org/package/babel-plugin-inline-json-import)

[![Build Status](https://travis-ci.org/yggie/babel-plugin-inline-json-import.svg?branch=master)](https://travis-ci.org/yggie/babel-plugin-inline-json-import)

A babel pre-processor that inlines all imports of JSON files straight into your
JavaScript files.

## Example

Given the following JSON file:

```json
{
  "foo": "bar"
}
```

The plugin will transform the following statement:

```js
import json from './path/to/file.json';
```

to:

```js
var json = { foo: "bar" };
```

Simple as that!

## Installation

Install the plugin through `npm`, you will also need `babel` installed for
obvious reasons:

```sh
$ npm install --save-dev babel-plugin-inline-json-import
```

Add `babel-plugin-inline-json-import` to the list of plugins. If you are using a
`.babelrc` file, the file should have an entry that looks like this:

```json
{
  "plugins": [
    ["inline-json-import", {}]
  ]
}
```

## Usage

This should work straight out of the box without any configuration.

## Contributing
1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request =)

## License
This project is licensed under the MIT License - see the [LICENSE](/LICENSE)
file for details
