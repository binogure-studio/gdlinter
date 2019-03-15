const re2 = require('re2')
const error = require('../../error')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^\s*enum\s(\w+)\s*/)

  if (regex.test(input)) {
    console.debug('ENUM KEYWORD')
    var enumName = regex.exec(input)[1]

    data.enums = data.enums || {}

    if (data.enums[enumName] != null) {
      data.enums[enumName].error = data.enums[enumName].error || []
      data.enums[enumName].error.push(error.ALREADY_DEFINED)
    } else {
      data.enums[enumName] = {}
    }

    input = input.replace(regex, '\n')

    let found = false
    let index = 0

    do {
      var result = parsingItems.declaration[index](data.enums[enumName], input)

      found = result.match

      if (found) {
        input = result.input
      }

      ++index
    } while (!found && index < parsingItems.declaration.length)

    console.debug('ENUM KEYWORD EXIT')
  }

  return input
}
