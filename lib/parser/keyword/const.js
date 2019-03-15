const re2 = require('re2')
const error = require('../../error')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^\s*const\s(\w+)\s*=\s*/)

  if (regex.test(input)) {
    console.debug('CONST KEYWORD')
    var constantName = regex.exec(input)[1]

    data.constants = data.constants || {}

    if (data.constants[constantName] != null) {
      data.constants[constantName].error = data.constants[constantName].error || []
      data.constants[constantName].error.push(error.ALREADY_DEFINED)
    } else {
      data.constants[constantName] = {}
    }

    input = input.replace(regex, '\n')

    let found = false
    let index = 0

    do {
      var result = parsingItems.declaration[index](data.constants[constantName], input)

      found = result.match

      if (found) {
        input = result.input
      }

      ++index
    } while (!found && index < parsingItems.declaration.length)

    console.debug('CONST KEYWORD EXIT')
  }

  return input
}
