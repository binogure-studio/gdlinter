const _ = require('lodash')
const errorCodes = require('./error')
const godotDoc = require('./godot-doc')

const regExpIgnoreFunctionNames = /^\s*(_init|_ready|_process|_fixed_process|_input|_unhandled_input|_input_event|_unhandled_key_input|_draw|_exit_tree)\s*$/
const lint_data = godotDoc()

const analyzeFunction = function (filename, data, scope, originalFunctionName, nesting) {
  var constants = data.constants || {}
  var variables = data.vars || {}
  var methods = data.methods || {}
  var classes = data.classes || {}
  var bloc = data.bloc || {}
  var inherits = data.inherits || ''
  var parentClass = {}

  if (nesting > 6 && filename != 'res://scripts/http/unirest.gd') {
    console.error(filename, originalFunctionName, `Too nested code bloc ${nesting}`)
  }

  // Concatenate parent classes
  if (inherits.length > 0) {
    if (lint_data[inherits] != null) {
      Object.keys(lint_data[inherits].methods).forEach((key) => {
        parentClass[key] = {
          value: lint_data[inherits].methods[key],
          arguments: lint_data[inherits].methods[key].arguments,
          type: 'func'
        }
      })

      Object.keys(lint_data[inherits].constants).forEach((key) => {
        parentClass[key] = {
          value: lint_data[inherits].constants[key],
          type: 'const'
        }
      })

      var parentInherit = lint_data[inherits].inherits

      while (parentInherit != null) {
        Object.keys(lint_data[parentInherit].methods).forEach((key) => {
          parentClass[key] = {
            value: lint_data[parentInherit].methods[key],
            arguments: lint_data[parentInherit].methods[key].arguments,
            type: 'func'
          }
        })

        Object.keys(lint_data[parentInherit].constants).forEach((key) => {
          parentClass[key] = {
            value: lint_data[parentInherit].constants[key],
            type: 'const'
          }
        })

        parentInherit = (lint_data[parentInherit] || {}).inherits
      }
    } else if (globalScope[inherits] != null) {
      parentClass = globalScope[inherits]
    } else if (lint_result[inherits] != null) {
      globalScope[inherits] = {}
      analyzeFunction(inherits, lint_result[inherits], globalScope[inherits], null, 0)
      parentClass = globalScope[inherits]
    } else {
      console.error(filename, originalFunctionName, `Inheritance error, cannot find original class ${inherits}`)
    }
  }

  // Variable shadowing
  Object.keys(constants).forEach((key) => {
    if (scope[key] != null) {
      console.error(filename, originalFunctionName, `Variable shadowing already defined ${key}`)
    } else if (parentClass[key] != null) {
      console.error(filename, originalFunctionName, `Variable shadowing already defined ${key} in parent class ${inherits}`)
    } else {
      scope[key] = {
        value: constants[key],
        type: 'const'
      }
    }
  })

  Object.keys(variables).forEach((key) => {
    // Guardian clause
    if ((variables[key].error || []).includes(errorCodes.NOT_DEFINED)) {
      return
    }

    if (scope[key] != null) {
      console.error(filename, originalFunctionName, `Variable shadowing already defined ${key}`)
    } else if (parentClass[key] != null && !(parentClass[key].error || []).includes(errorCodes.NOT_DEFINED)) {
      console.error(filename, originalFunctionName, `Variable shadowing already defined ${key} in parent class ${inherits}`)
    } else {
      scope[key] = {
        value: variables[key],
        type: 'var'
      }
    }
  })

  Object.keys(bloc).forEach((key) => {
    var nestedData = bloc[key]

    analyzeFunction(filename, nestedData, Object.assign({}, scope, {}), originalFunctionName, nesting + 1)
  })

  Object.keys(methods).forEach((key) => {
    var nestedData = methods[key]

    if (scope[key] != null) {
      if (scope[key].type == 'func') {
        // Skip ignored functions
        if (regExpIgnoreFunctionNames.test(key)) {
          return
        }
        if (scope[key].arguments.length != nestedData.arguments.length) {
          console.error(filename, originalFunctionName, `Inheritance arguments size mismatch ${key} (inherits: ${inherits})`)
        }
      } else {
        console.error(filename, originalFunctionName, `Variable shadowing already defined ${key}`)
      }
    } else if (parentClass[key] != null) {
      if (parentClass[key].type == 'func') {
        // Skip ignored functions
        if (regExpIgnoreFunctionNames.test(key)) {
          return
        }

        if (parentClass[key].arguments.length != nestedData.arguments.length) {
          console.error(filename, originalFunctionName, `Inheritance arguments size mismatch ${key} (inherits: ${inherits})`)
        }
      } else {
        console.error(filename, originalFunctionName, `Variable shadowing already defined ${key}`)
      }
    } else {
      scope[key] = {
        value: methods[key],
        arguments: methods[key].arguments,
        type: 'func'
      }
    }

    analyzeFunction(filename, nestedData, Object.assign({}, scope, {}), key, nesting + 1)
  })

  Object.keys(classes).forEach((key) => {
    var nestedData = classes[key]

    analyzeFunction(filename, nestedData, Object.assign({}, scope, {}), originalFunctionName, nesting + 1)
  })

  // Has to be done at the end to be sure that we are not reviewing the same data more than once
  _.merge(scope, parentClass)
}

var globalScope = {}
var lint_result = {}

module.exports = (data) => {
  globalScope = {}
  lint_result = data

  Object.keys(data).forEach((filename) => {
    var fileData = data[filename]

    if (globalScope[filename] == null) {
      globalScope[filename] = {}
      analyzeFunction(filename, fileData, globalScope[filename], null, 0)
    }
  })

  console.log(`\n\nCode analyzed!`)
}
