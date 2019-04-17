const re2 = require('re2')

module.exports = (key, input) => {
  var match = false
  var regex = new re2(/^\s*\{([\s\n,]*|[\w]+|[\w]+\s*\=\s*[0-9]+\s*)*\}\s*\n/)

  if (regex.test(input)) {
    console.debug('MATCH ENUM')
    let regexResult = regex.exec(input)

    key.value = regexResult[1]
    input = input.replace(regex, '\n')
    match = true
  }

  return { match, input }
}
