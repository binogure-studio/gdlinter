const re2 = require('re2')
const error = require('../../error')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^\s*signal\s+([\w]+)\(([\w]+\s*(,\s*[\w]+)*)*\)\s*/)

  if (regex.test(input)) {
    console.debug('SIGNAL KEYWORD')
    var signalName = regex.exec(input)[1]

    data.signals = data.signals || {}

    if (data.signals[signalName] != null) {
      data.signals[signalName].error = data.signals[signalName].error || []
      data.signals[signalName].error.push(error.ALREADY_DEFINED)
    } else {
      data.signals[signalName] = {}
    }

    console.debug('SIGNAL KEYWORD EXIT')
    input = input.replace(regex, '\n')
  }

  return input
}
