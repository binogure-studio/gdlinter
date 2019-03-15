const fs = require('fs')
const path = require('path')
const parser = require('xml2json')
const config = require('../config/default')

module.exports = () => {
  const documentation = config.documentation
  const godot_documentation = JSON.parse(parser.toJson(fs.readFileSync(path.resolve(__dirname, '..', 'doc', documentation))))

  return godot_documentation.doc.class.reduce((acc, item) => {
    var methods = {}
    var constants = {}

    if (typeof item.methods === 'object') {
      if (Array.isArray(item.methods.method)) {
        methods = item.methods.method.reduce((methodAcc, method) => {
          methodAcc[method.name] = {
            return: (method.return == null) ? 'Nil' : method.return.type,
            arguments: Array.isArray(method.argument) ? method.argument : [method.argument]
          }

          return methodAcc
        }, {})
      } else {
        methods[item.methods.method.name] = {
          return: (item.methods.method.return == null) ? 'Nil' : item.methods.method.return.type,
          arguments: Array.isArray(item.methods.method.argument) ? item.methods.method.argument : [item.methods.method.argument]
        }
      }
    }

    if (typeof item.constants === 'object') {
      if (Array.isArray(item.constants.constant)) {
        constants = item.constants.constant.reduce((constantAcc, constant) => {
          constantAcc[constant.name] = constant.value

          return constantAcc
        }, {})
      } else {
        constants[item.constants.constant.name] = item.constants.constant.value
      }
    }

    acc[item.name] = {
      methods: methods,
      constants: constants,
      inherits: item.inherits
    }

    return acc
  }, {})
}
