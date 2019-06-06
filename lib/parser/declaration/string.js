const re2 = require('re2')

module.exports = (key, input) => {
  var regex = new re2(/^\s*(['][^']+[']|["][^"]+["])\s*\n/)
  var match = false

  if (regex.test(input)) {
    console.debug('MATCH STRING')
    let regexResult = regex.exec(input)

    key.value = regexResult[1]
    input = input.replace(regex, '\n')
    match = true
  }

  return { match, input }
}