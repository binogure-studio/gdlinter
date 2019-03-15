const re2 = require('re2')

module.exports = (key, input) => {
  var regex = new re2(/^\s*(\.?[\w\[\]'"]+((\.[\w\[\]'"]+)*)\((|.*\s*(,\s*.+)*)\)(\.[\w]+|\((|.*\s*(,\s*.+)*)\))*)\s*\n/)
  var match = false

  if (regex.test(input)) {
    console.debug('MATCH FUNC CALL')
    let regexResult = regex.exec(input)

    key.call = key.call || []
    key.call.push(regexResult[1])

    input = input.replace(regex, '\n')
    match = true
  }

  return { match, input }
}
