const re2 = require('re2')
const error = require('../../error')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^\s*(export|export\([^\)]+\)|onready\s*)?\s*var\s(\w+)\s*[+\-\/*~]{0,1}\s*\n/)

  if (regex.test(input)) {
    console.debug('VAR KEYWORD (NO ASSIGN)')
    var varName = regex.exec(input)[2]

    data.vars = data.vars || {}

    if (data.vars[varName] != null) {
      data.vars[varName].error = data.vars[varName].error || []
      data.vars[varName].error.push(error.ALREADY_DEFINED)
    } else {
      data.vars[varName] = {}
    }

    input = input.replace(regex, '\n')
    console.debug('VAR KEYWORD EXIT (NO ASSIGN)')
  }

  return input
}
