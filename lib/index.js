const parser = require('./parser')
const analyzer = require('./analyzer')
const config = require('../config/default')

if (!config.debug) {
  console.debug = () => {}
}

console.error = function (filename, functionName, message) {
  console.log(`[${filename}] ${message}${functionName == null ? '' : ' (from: ' + functionName + ')'}`)
}

analyzer(parser())
