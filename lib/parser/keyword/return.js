const re2 = require('re2')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^\s*return(\s+[^\n]*)\s*/)

  if (regex.test(input)) {
    console.debug('RETURN KEYWORD')

    console.debug('RETURN KEYWORD EXIT')
    input = input.replace(regex, '\n')
  }

  return input
}
