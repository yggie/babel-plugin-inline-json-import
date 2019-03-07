import fs from 'fs'
import tmp from 'tmp'
import path from 'path'
import { expect } from 'chai'
import { transform, transformFileSync } from 'babel-core'

tmp.setGracefulCleanup()

describe('babel-plugin-inline-json-imports', () => {
  it('inlines simple JSON imports', () => {
    const t = configureTransform()
    const result = t(`
      import json from '../test/fixtures/example.json'

      console.log(json)
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      const json = { example: true }

      console.log(json)
    `))
  })

  it('inlines simple systemjs JSON imports', () => {
    const t = configureTransform()
    const result = t(`
      import json from '../test/fixtures/example.json!json'

      console.log(json)
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      const json = { example: true }

      console.log(json)
    `))
  })

  it('supports destructuring of the JSON imports', () => {
    const t = configureTransform()
    const result = t(`
      import {example} from '../test/fixtures/example.json'

      console.log(example)
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      const { example: example } = { example: true }

      console.log(example)
    `))
  })

  it('does not inline other kinds of imports', () => {
    const t = configureTransform()
    const result = t(`
      import babel from 'babel-core'
      import css from './styles.css'
      import json from '../test/fixtures/example.json'

      console.log(json)
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      import babel from 'babel-core'
      import css from './styles.css'
      const json = { example: true }

      console.log(json)
    `))
  })

  it('respects the file location of the imports', () => {
    const contents = `
      import json from '../fixtures/example.json'

      console.log(json)
    `
    const file = tmp.fileSync({ postfix: '.js', dir: './test/tmp' })
    fs.writeFileSync(file.name, contents)

    const t = configureTransform({}, true)
    const result = t(file.name)

    expect(normalize(result.code)).to.equal(normalize(`
      const json = { example: true }

      console.log(json)
    `))
  })

  it('supports the require syntax', () => {
    const t = configureTransform()
    const result = t(`
      var json = require('../test/fixtures/example.json')
      var notJson = fake.require('../test/fixtures/example.json')

      console.log(json)
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      var json = { example: true }
      var notJson = fake.require('../test/fixtures/example.json')

      console.log(json)
    `))
  })

  it('supports the require syntax with complex declarations', () => {
    const t = configureTransform()
    const result = t(`
      let json = require('../test/fixtures/example.json'),
          notJson = fake.require('../test/fixtures/example.json'),
          { example } = require('../test/fixtures/example.json')

      console.log(json, example)
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      let json = { example: true },
          notJson = fake.require('../test/fixtures/example.json'),
          { example } = { example: true }

      console.log(json, example)
    `))
  })

  it('supports opt  variable declaration', () => {
    const t = configureTransform()
    const result = t(`
      var a;
      let c;
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      var a;
      let c;
    `))
  })

  it('correctly ignores non-JSON files', () => {
    const t = configureTransform()
    const result = t(`
      import json from '../test/fixtures/example.json'

      import abc from 'abc'
      import { a, b } from './foo.mp3';

      const file = require('../src/index.js')
      const example = require('./example')
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      const json = { example: true }
      import abc from 'abc'
      import { a, b } from './foo.mp3';

      const file = require('../src/index.js')
      const example = require('./example')
    `))
  })

  function configureTransform(options = {}, isFile) {
    return function configuredTransform(string) {
      const transformOptions = {
        babelrc: false,
        presets: [],
        plugins: [[path.resolve('./src'), options]],
      }

      if (isFile) {
        return transformFileSync(string, transformOptions)
      } else {
        return transform(string.trim(), transformOptions)
      }
    }
  }

  function normalize(code) {
    return transform(squashWhitespace(code)).code
  }

  function squashWhitespace(code) {
    return code.trim().replace(/\s+/g, '\n')
  }
})
