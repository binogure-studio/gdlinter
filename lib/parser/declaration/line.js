const re2 = require('re2')

module.exports = (key, input) => {
  var regex = new re2(/^\n\s*[^\n]+\s*\n/)
  var match = false

  if (regex.test(input)) {
    console.debug('MATCH SINGLE LINE')
    let regexResult = regex.exec(input)

    key.value = regexResult[1]
    input = input.replace(regex, '\n')
    match = true
  }

  return { match, input }
}
