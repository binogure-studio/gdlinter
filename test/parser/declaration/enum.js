const assert = require('assert')

describe('Enum declaration parser', () => {
  const enumDeclarationParser = require('../../../lib/parser/declaration/enum')

  describe('should detect an enumerate', () => {
    it('simple', (done) => {
      let result = enumDeclarationParser({}, '{ BONJOUR }\n')

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })

    it('empty', (done) => {
      let result = enumDeclarationParser({}, '{}\n')

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })

    it('with one assignment', (done) => {
      let result = enumDeclarationParser({}, '{ TEST = 0 }\n')

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })

    it('with several assignments', (done) => {
      let result = enumDeclarationParser({}, '{ TEST = 0, BONJOUR = 2, VIGUEUR = 4 }\n')

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })
  })

  describe('should not detect a function declaration', () => {
    it('without argument', (done) => {
      let key = {}
      let input = 'func foo():\n'
      let result = enumDeclarationParser(key, input)

      assert.equal(result.input, input)
      assert.equal(result.match, false)

      done()
    })

    it('with one argument', (done) => {
      let key = {}
      let input = 'func foo(bar):\n'
      let result = enumDeclarationParser(key, input)

      assert.equal(result.input, input)
      assert.equal(result.match, false)

      done()
    })

    it('with 3 arguments', (done) => {
      let key = {}
      let input = 'func foo(bar, zoo, keeper):\n'
      let result = enumDeclarationParser(key, input)

      assert.equal(result.input, input)
      assert.equal(result.match, false)

      done()
    })
  })
})
