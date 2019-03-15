const re2 = require('re2')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^\s*extends\s+([^\n]+)\s*/)

  if (regex.test(input)) {
    console.debug('EXTENDS KEYWORD')
    var parentClass = regex.exec(input)[1].replace(/['"]/g, '')

    data.inherits = parentClass
    console.debug('EXTEND KEYWORD EXIT')

    input = input.replace(regex, '\n')
  }

  return input
}
