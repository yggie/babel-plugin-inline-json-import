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

  it('supports named import from a JSON', () => {
    const t = configureTransform()
    const result = t(`
      import { used } from '../test/fixtures/named-example.json'

      console.log(used)
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      const used = true

      console.log(used)
    `))
  })

  it('supports named import with a alias name from a JSON', () => {
    const t = configureTransform()
    const result = t(`
      import { used as otherName } from '../test/fixtures/named-example.json'

      console.log(otherName)
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      const otherName = true

      console.log(otherName)
    `))
  })

  it('supports two named import from a JSON', () => {
    const t = configureTransform()
    const result = t(`
      import { used, otherUsed } from '../test/fixtures/named-example.json'

      console.log(used, otherName)
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      const used = true
      const otherUsed = true

      console.log(used, otherName)
    `))
  })

  it('supports two named import with a alias name from a JSON', () => {
    const t = configureTransform()
    const result = t(`
      import { used as one, otherUsed as two } from '../test/fixtures/named-example.json'

      console.log(one, two)
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      const one = true
      const two = true

      console.log(one, two)
    `))
  })

  it('supports kebab named import from a JSON', () => {
    const t = configureTransform()
    const result = t(`
      import { kebabExample } from '../test/fixtures/named-example.json'

      console.log(kebabExample)
    `)

    expect(normalize(result.code)).to.equal(normalize(`
      const kebabExample = true

      console.log(kebabExample)
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
