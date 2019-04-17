const assert = require('assert')

describe('String declaration parser', () => {
  const stringDeclarationParser = require('../../../lib/parser/declaration/string')

  describe('should detect a string', () => {
    it('simple', (done) => {
      let result = stringDeclarationParser({}, `'Petit test des familles'\n`)

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })

    it('including a singlequote', (done) => {
      let result = stringDeclarationParser({}, `"'Petit test des familles, "\n`)

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })

    it('including a pair of double quotes', (done) => {
      let result = stringDeclarationParser({}, `'"Petit test des familles, "'\n`)

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })

    it('with recursive string', (done) => {
      let result = stringDeclarationParser({}, `'"Petit test" "des familles, "'\n`)

      assert.equal(result.input, '\n')
      assert.equal(result.match, true)

      done()
    })
  })

  describe('should not detect anything else', () => {
    it('without argument', (done) => {
      let key = {}
      let input = 'func foo():\n'
      let result = stringDeclarationParser(key, input)

      assert.equal(result.input, input)
      assert.equal(result.match, false)

      done()
    })

    it('with one argument', (done) => {
      let key = {}
      let input = 'func foo(bar):\n'
      let result = stringDeclarationParser(key, input)

      assert.equal(result.input, input)
      assert.equal(result.match, false)

      done()
    })

    it('with 3 arguments', (done) => {
      let key = {}
      let input = 'func foo(bar, zoo, keeper):\n'
      let result = stringDeclarationParser(key, input)

      assert.equal(result.input, input)
      assert.equal(result.match, false)

      done()
    })
  })
})
