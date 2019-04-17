const assert = require('assert')

describe('Call declaration parser', () => {
  const callDeclarationParser = require('../../../lib/parser/declaration/call')

  describe('should detect a function call', () => {
    it('without argument', (done) => {
      let result = callDeclarationParser({}, 'foo()\n')

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })

    it('with one argument', (done) => {
      let result = callDeclarationParser({}, 'foo(bar)\n')

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })

    it('with 3 arguments', (done) => {
      let result = callDeclarationParser({}, 'foo(bar, zoo, keeper)\n')

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })

    it('combined with another function call', (done) => {
      let result = callDeclarationParser({}, 'foo(bar, zoo, keeper).bar()\n')

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })
  })

  describe('should not detect a function declaration', () => {
    it('without argument', (done) => {
      let key = {}
      let input = 'func foo():\n'
      let result = callDeclarationParser(key, input)

      assert.equal(result.input, input)
      assert.equal(result.match, false)

      done()
    })

    it('with one argument', (done) => {
      let key = {}
      let input = 'func foo(bar):\n'
      let result = callDeclarationParser(key, input)

      assert.equal(result.input, input)
      assert.equal(result.match, false)

      done()
    })

    it('with 3 arguments', (done) => {
      let key = {}
      let input = 'func foo(bar, zoo, keeper):\n'
      let result = callDeclarationParser(key, input)

      assert.equal(result.input, input)
      assert.equal(result.match, false)

      done()
    })
  })
})
