const re2 = require('re2')
const errorCodes = require('../../error')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^\s*((\.?\w|\[['"]?(\.?\w)+['"]?\])+)\s*[+\-\/*~]{0,1}=\s*/)

  if (regex.test(input)) {
    console.debug('ASSIGN KEYWORD')
    var regexResult = regex.exec(input)
    var varName = regexResult[1]

    data.vars = data.vars || {}

    if (data.vars[varName] == null) {
      data.vars[varName] = {
        error: [errorCodes.NOT_DEFINED]
      }
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

    console.debug('ASSIGN KEYWORD EXIT')
  }

  return input
}
