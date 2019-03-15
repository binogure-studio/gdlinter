const re2 = require('re2')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^\s*(\.?[\w\[\]'"]+((\.[\w\[\]'"]+)*)\((|.*\s*(,\s*.+)*)\)(\.[\w]+|\((|.*\s*(,\s*.+)*)\))*)\s*\n/)

  if (regex.test(input)) {
    console.debug('FUNCTION CALL')
    var regexResult = regex.exec(input)

    data.call = data.call || []
    data.call.push(regexResult[1])

    input = input.replace(regex, '')
    console.debug('FUNCTION CALL EXIT')
  }

  return input
}
