# babel-plugin-inline-json-import
[![Build Status](https://travis-ci.org/yggie/babel-plugin-inline-json-import.svg?branch=master)](https://travis-ci.org/yggie/babel-plugin-inline-json-import)

Inlines imports of JSON files

## Example

Given the following _data.json_.

```json
{ "foo": "bar" }
```

#### in

```js
import json from './data.json';
```

#### out

```js
var json = { foo: "bar" };
```


## Installation

```sh
$ npm install --save-dev babel-plugin-inline-json-import
```

**No `.babelrc` entry required!**
