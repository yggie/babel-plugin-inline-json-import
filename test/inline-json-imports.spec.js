import fs from 'fs'
import tmp from 'tmp'
import path from 'path'
import {expect} from 'chai'
import {transformSync, transformFileSync} from '@babel/core'

tmp.setGracefulCleanup()

describe('babel-plugin-inline-json-imports', () => {
  it('inlines simple JSON imports', () => {
    const t = configureTransform()
    const result = t(`
      import json from './test/fixtures/example.json'

      console.log(json)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const json = { example: true }

      console.log(json)
    `)
    )
  })

  it('inlines any valid JSON file', () => {
    const t = configureTransform()
    const result = t(`
      import arr from './test/fixtures/array.json'
      import num from './test/fixtures/number.json'
      import str from './test/fixtures/string.json'
      import nil from './test/fixtures/null.json'
      console.log(arr, num, str, nil)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const arr = ["1st", "2nd", "3rd", "4th", "5th"]
      const num = 1337
      const str = "json-string"
      const nil = null
      console.log(arr, num, str, nil)
    `)
    )
  })

  it('supports destructuring of the JSON imports', () => {
    const t = configureTransform()
    const result = t(`
      import {example} from './test/fixtures/example.json'

      console.log(example)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const example = true

      console.log(example)
    `)
    )
  })

  it('supports destructuring non-existant properties', () => {
    const t = configureTransform()
    const result = t(`
      import {dud} from './test/fixtures/example.json'

      console.log(dud)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const dud = undefined

      console.log(dud)
    `)
    )
  })

  it('throws when destructuring non-object', () => {
    const t = configureTransform()
    expect(() => {
      t(`import {example} from './test/fixtures/array.json'`)
    }).to.throw('destructure from non-object')
    expect(() => {
      t(`import {example} from './test/fixtures/number.json'`)
    }).to.throw('destructure from non-object')
    expect(() => {
      t(`import {example} from './test/fixtures/string.json'`)
    }).to.throw('destructure from non-object')
    expect(() => {
      t(`import {example} from './test/fixtures/null.json'`)
    }).to.throw('destructure from non-object')
  })

  it('supports destructuring of multiple JSON imports', () => {
    const t = configureTransform()
    const result = t(`
      import {example, deep} from './test/fixtures/complex.json'

      console.log(example, deep)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const example = true
      const deep = {
        nested: {
          array: [1, 2, 3]
        }
      }

      console.log(example, deep)
    `)
    )
  })

  it('supports aliased destructuring', () => {
    const t = configureTransform()
    const result = t(`
      import {example, deep as complex} from './test/fixtures/complex.json'

      console.log(example, complex)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const example = true
      const complex = {
        nested: {
          array: [1, 2, 3]
        }
      }

      console.log(example, complex)
    `)
    )
  })

  it('supports aliased destructuring with odd keys', () => {
    const t = configureTransform()
    const result = t(`
      import {"🥌" as emoji, delicious} from './test/fixtures/keys.json'

      console.log(emoji !== delicious)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const emoji = "curling"
      const delicious = true

      console.log(emoji !== delicious)
    `)
    )
  })

  it('inlines fully on namespace import JSON imports', () => {
    const t = configureTransform()
    const result = t(`
      import * as example from './test/fixtures/example.json'

      console.log(example)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const example = { example: true }

      console.log(example)
    `)
    )
  })

  it('aliases to same variable on default + namespace import', () => {
    const t = configureTransform()
    const result = t(`
      import allOfIt, * as noReallyAllOfIt from './test/fixtures/example.json'

      console.log(allOfIt === noReallyAllOfIt)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const allOfIt = { example: true }
      const noReallyAllOfIt = allOfIt

      console.log(allOfIt === noReallyAllOfIt)
    `)
    )
  })

  it('references default when mixing default + named', () => {
    const t = configureTransform()
    const result = t(`
      import allOfIt, {delicious, "🥌" as evenWithEmoji} from './test/fixtures/keys.json'

      console.log(allOfIt.delicious === delicious)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const allOfIt = { delicious: true, "\\uD83E\\uDD4C": "curling" }
      const delicious = allOfIt.delicious 
      const evenWithEmoji = allOfIt["🥌"]

      console.log(allOfIt.delicious === delicious)
    `)
    )
  })

  it('falls back to full inlining with assignment on mixed default + named import', () => {
    const t = configureTransform()
    const result = t(`
      import full, {deep} from './test/fixtures/complex.json'

      console.log(full.deep === deep)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const full = {
        example: true,
        deep: {
          nested: {
            array: [1, 2, 3]
          }
        }
      }
      const deep = full.deep

      console.log(full.deep === deep)
    `)
    )
  })

  it('does not inline other kinds of imports', () => {
    const t = configureTransform()
    const result = t(`
      import babel from 'babel-core'
      import css from './styles.css'
      import json from './test/fixtures/example.json'

      console.log(json)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      import babel from 'babel-core'
      import css from './styles.css'
      const json = { example: true }

      console.log(json)
    `)
    )
  })

  it('respects the file location of the imports', () => {
    const contents = `
      import json from '../fixtures/example.json'

      console.log(json)
    `
    const file = tmp.fileSync({postfix: '.js', dir: './test/tmp'})
    fs.writeFileSync(file.name, contents)

    const t = configureTransform({}, true)
    const result = t(file.name)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const json = { example: true }

      console.log(json)
    `)
    )
  })

  it('can be given pattern to match on', () => {
    const contentsYes = `
      import json from '../fixtures/example.json'
      console.log(json)
    `
    const contentsNo = `
      import json from '../fixtures/string.json'
      console.log(json)
    `

    const yesFile = tmp.fileSync({postfix: '.js', dir: './test/tmp'})
    const noFile = tmp.fileSync({postfix: '.js', dir: './test/tmp'})
    fs.writeFileSync(yesFile.name, contentsYes)
    fs.writeFileSync(noFile.name, contentsNo)

    const t = configureTransform({match: /example\.json$/}, true)
    const resultYes = t(yesFile.name)
    const resultNo = t(noFile.name)

    expect(normalize(resultYes.code)).to.equal(
      normalize(`
      const json = { example: true }
      console.log(json)
    `)
    )

    expect(normalize(resultNo.code)).to.equal(normalize(contentsNo))
  })

  it('supports the require syntax', () => {
    const t = configureTransform()
    const result = t(`
      var json = require('./test/fixtures/example.json')
      var notJson = fake.require('./test/fixtures/example.json')

      console.log(json)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      var json = { example: true }
      var notJson = fake.require('./test/fixtures/example.json')

      console.log(json)
    `)
    )
  })

  it('supports the require syntax with complex declarations', () => {
    const t = configureTransform()
    const result = t(`
      let json = require('./test/fixtures/example.json'),
          notJson = fake.require('./test/fixtures/example.json'),
          { example } = require('./test/fixtures/example.json')

      console.log(json, example)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      let json = { example: true },
          notJson = fake.require('./test/fixtures/example.json'),
          example = true

      console.log(json, example)
    `)
    )
  })

  it('supports destructuring require statements', () => {
    const t = configureTransform()
    const result = t(`
      var {example, deep: deepObj} = require('./test/fixtures/complex.json')

      console.log(example, deepObj)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      var example = true, 
          deepObj = {
            nested: {
              array: [1, 2, 3]
            }
          }

      console.log(example, deepObj)
    `)
    )
  })

  // Left as an exercise to the reader!
  // Currently just falls back to importing the whole file, _then_ destructuring
  it.skip('supports destructuring deep require statements', () => {
    const t = configureTransform()
    const result = t(`
      var {deep: {nested: {array: [, second]}}} = require('./test/fixtures/complex.json')

      console.log(second)
    `)
    console.log(result.code)

    expect(normalize(result.code)).to.equal(
      normalize(`
      var second = 2

      console.log(second)
    `)
    )
  })

  it('supports destructuring array require statements', () => {
    const t = configureTransform()
    const result = t(`
      var [first, , third, ...rest] = require('./test/fixtures/array.json')

      console.log(first, third, ...rest)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      var first = "1st", 
          third = "3rd",
          rest = ["4th", "5th"]

      console.log(first, third, ...rest)
    `)
    )
  })

  it('supports destructuring string require statements', () => {
    const t = configureTransform()
    const result = t(`
      var [firstChar] = require('./test/fixtures/string.json')

      console.log(firstChar)
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      var firstChar = "j"

      console.log(firstChar)
    `)
    )
  })

  it('supports opt variable declaration', () => {
    const t = configureTransform()
    const result = t(`
      var a;
      let c;
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      var a;
      let c;
    `)
    )
  })

  it('correctly ignores non-JSON files', () => {
    const t = configureTransform()
    const result = t(`
      import json from './test/fixtures/example.json'

      import abc from 'abc'
      import { a, b } from './foo.mp3';

      const file = require('../src/index.js')
      const example = require('./example')
    `)

    expect(normalize(result.code)).to.equal(
      normalize(`
      const json = { example: true }
      import abc from 'abc'
      import { a, b } from './foo.mp3';

      const file = require('../src/index.js')
      const example = require('./example')
    `)
    )
  })

  function configureTransform(options, isFile) {
    return function configuredTransform(string) {
      const transformOptions = {
        babelrc: false,
        presets: [],
        plugins: options ? [[path.resolve('./build'), options]] : [path.resolve('./build')],
        sourceRoot: __dirname,
      }

      if (isFile) {
        return transformFileSync(string, transformOptions)
      } else {
        return transformSync(string.trim(), transformOptions)
      }
    }
  }

  function normalize(code) {
    return transformSync(squashWhitespace(code)).code
  }

  function squashWhitespace(code) {
    return code.trim().replace(/\s+/g, '\n')
  }
})
