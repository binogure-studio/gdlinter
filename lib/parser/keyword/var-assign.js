const re2 = require('re2')
const error = require('../../error')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^\s*(export|export\([^\)]+\)|onready\s*)?\s*var\s(\w+)\s*[+\-\/*~]{0,1}=\s*/)

  if (regex.test(input)) {
    console.debug('VAR KEYWORD')
    var varName = regex.exec(input)[2]

    data.vars = data.vars || {}

    if (data.vars[varName] != null) {
      data.vars[varName].error = data.vars[varName].error || []
      data.vars[varName].error.push(error.ALREADY_DEFINED)
    } else {
      data.vars[varName] = {}
    }

    input = input.replace(regex, '\n')

    let found = false
    let index = 0

    do {
      var result = parsingItems.declaration[index](data.vars[varName], input)

      found = result.match

      if (found) {
        input = result.input
      }

      ++index
    } while (!found && index < parsingItems.declaration.length)

    console.debug('VAR KEYWORD EXIT')
  }

  return input
}
