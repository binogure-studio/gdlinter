const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const parser = require('xml2json')
const re2 = require('re2')

let debug_flag = false

// Error list
const ALREADY_DEFINED = 1
const NOT_DEFINED = 2
const regExpIgnoreFunctionNames = /^\s*(_init|_ready|_process|_fixed_process|_input|_unhandled_input|_input_event|_unhandled_key_input|_draw|_exit_tree)\s*$/

if (process.argv.length > 2) {
  debug_flag = true
}

const log_error = function (filename, functionName, message) {
  console.log(`[${filename}] ${message}${functionName == null ? '' : ' (from: ' + functionName + ')'}`)
}

const log_debug = function (message) {
  if (debug_flag) {
    console.log(message)
  }
}

const declaration = [
  (key, input) => {
    var match = false
    var regex = new re2(/^\n\s*\{([\s\n,]*|[\w]+|[\w]+\s*\=\s*[0-9]+\s*)*\}/)

    if (regex.test(input)) {
      log_debug('MATCH ENUM')
      let regexResult = regex.exec(input)
      
      key.value = regexResult[1]
      input = input.replace(regex, '\n')
      match = true
    }

    return { match, input }
  },
  (key, input) => {
    var regex = new re2(/^\n(['"][^'"]+['"])\s*\n/)
    var match = false

    if (regex.test(input)) {
      log_debug('MATCH STRING')
      let regexResult = regex.exec(input)

      key.value = regexResult[1]
      input = input.replace(regex, '\n')
      match = true
    }

    return { match, input }
  },
  (key, input) => {
    var regex = new re2(/^\s*(\.?[\w\[\]'"]+((\.[\w\[\]'"]+)*)\((|.*\s*(,\s*.+)*)\)(\.[\w]+|\((|.*\s*(,\s*.+)*)\))*)\s*\n/)
    var match = false

    if (regex.test(input)) {
      log_debug('MATCH FUNC CALL')
      let regexResult = regex.exec(input)

      key.call = key.call || []
      key.call.push(regexResult[1])

      input = input.replace(regex, '\n')
      match = true
    }

    return { match, input }
  },
  (key, input) => {
    var regex = new re2(/^\n\s*[^\n]+\s*\n/)
    var match = false


    if (regex.test(input)) {
      log_debug('MATCH SINGLE LINE')
      let regexResult = regex.exec(input)

      key.value = regexResult[1]
      input = input.replace(regex, '\n')
      match = true
    }

    return { match, input }
  },
]

const keywords = [
  // Spaces
  (data, input) => input.replace(/^[\s\n]*$/g, ''),

  // Empty line
  (data, input) => input.replace(/\n\s*\n/g, '\n'),

  // Empty line
  (data, input) => input.replace(/^\s*\n/g, '\n'),

  // Continue/break
  (data, input) => input.replace(/^\s*(continue|break|pass)\s*\n/g, '\n'),

  // Manage extends keyword
  (data, input) => {
    var regex = new re2(/^\s*extends\s+([^\n]+)\s*/)

    if (regex.test(input)) {
      log_debug('EXTENDS KEYWORD')
      var parentClass = regex.exec(input)[1].replace(/['"]/g, '')

      data.inherits = parentClass
      log_debug('EXTEND KEYWORD EXIT')

      input = input.replace(regex, '\n')
    }

    return input
  },

  // Manage class keyword
  (data, input) => {
    var regex = new re2(/^\s*class\s+([\w]+)\s*(extends\s+([^\n]+)\s*)?:\s*\n/)

    if (regex.test(input)) {
      log_debug('CLASS KEYWORD')
      var regexResult = regex.exec(input)
      var className = regexResult[1].replace(/['"]/g, '')
      var parentClass = (regexResult[3] || '').replace(/['"]/g, '')

      data.classes = data.classes || {}

      data.classes[className] = {
        name: className,
        inherits: parentClass
      }
      
      var classSelect = new re2(/^\s*class\s+([\w]+)\s*(extends\s+([^\n]+)\s*)?:\s*\n(  \s*[^\n]*\n|\s*\n)+/)
      var classCore = classSelect.exec(input)[0].replace(regex, '')

      while (classCore.length > 0) {
        let oldLength = classCore.length

        classCore = keywords.reduce(
          (acc, func) => func(data.classes[className], acc),
          classCore).replace(/^\s*#[^\n]*/g, '')

        if (oldLength == classCore.length) {
          console.error(`${classCore}`)

          process.exit()
        }
      }

      input = input.replace(classSelect, '')
      log_debug('CLASS KEYWORD EXIT')
    }

    return input
  },

  // Manage func keyword
  (data, input) => {
    var regex = new re2(/^\s*(static\s*)?func\s+(\w+)\(\s*(\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*(\s*,\s*\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*)*)*\)(\.\(\s*(\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*(\s*,\s*\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*)*)*\)){0,1}\s*:\s*\n/)

    while (regex.test(input)) {
      log_debug('FUNC KEYWORD')
      var regexResult = regex.exec(input)
      var methodName = regexResult[2]
      var arguments = (regexResult[3] == null) ? [] : regexResult[3].split(/,\s*/)

      data.methods = data.methods || {}
      data.methods[methodName] = {
        name: methodName,
        arguments: arguments,
      }

      var methodSelect = /\s*(static\s*){0,1}func\s+(\w+)\(\s*(\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*(\s*,\s*\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*)*)*\)(\.\(\s*(\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*(\s*,\s*\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*)*)*\)){0,1}\s*:\s*\n(  [^\n]*\n|\s*\n)*/
      var methodCore = methodSelect.exec(input)[0].replace(regex, '')

      while (methodCore.length > 0) {
        let oldLength = methodCore.length

        methodCore = keywords.reduce(
          (acc, func) => func(data.methods[methodName], acc),
          methodCore).replace(/^\s*#[^\n]*/g, '')

        if (oldLength == methodCore.length) {
          console.error(`${methodCore}`)

          process.exit()
        }
      }

      input = input.replace(methodSelect, '')
      log_debug('FUNC KEYWORD EXIT')
    }


    return input
  },

  // Manage if/elif/else/for/while keywords
  (data, input) => {
    var regex = new re2(/^(\s{2,})(if|else|elif|while|for)(\s+[^\n]+)?\s*:\n/)

    while (regex.test(input)) {
      log_debug('IF/ELIF/ELSE/FOR/WHILE KEYWORDS')
      var regexResult = regex.exec(input)
      var spacePad = `${regexResult[1].replace(/\n/, '')}`
      var regexStr = `^${spacePad}((if|else|elif|while|for)(\\s+[^\\n]+)?)\\s*:\\s*\\n(${spacePad}  [^\\n]+\\n|\\s*\\n)+`
      var blocRegEx = new re2(regexStr)
      var blocRegexResult = blocRegEx.exec(input.replace(/^\s*\n+/, ''))

      if (blocRegexResult == null) {
        log_debug('IF/ELIF/ELSE/FOR/WHILE KEYWORDS EXIT (NO MATCH)')
        // Not the right bloc
        break
      }

      var blocName = blocRegexResult[1]
      data.bloc = data.bloc || {}
      data.bloc[blocName] = {
        name: blocName
      }

      var blocCore = blocRegexResult[0].replace(/[^\n]+\n/, '') || ''

      input = input.replace(/^\s*\n/, '').replace(`${blocName}:`, '').replace(blocCore, '')


      while (blocCore.length > 0) {
        let oldLength = blocCore.length

        blocCore = keywords.reduce(
          (acc, func) => func(data.bloc[blocName], acc),
          blocCore).replace(/^\s*#[^\n]*/g, '')

        if (oldLength == blocCore.length) {
          console.error(`${blocCore}`)
          process.exit()
        }
      }

      log_debug('IF/ELIF/ELSE/FOR/WHILE KEYWORDS EXIT')
    }

    return input
  },

  // Manage const keyword
  (data, input) => {
    var regex = new re2(/^\s*const\s(\w+)\s*=\s*/)
    
    if (regex.test(input)) {
      log_debug('CONST KEYWORD')
      var constantName = regex.exec(input)[1]

      data.constants = data.constants || {}

      if (data.constants[constantName] != null) {
        data.constants[constantName].error = data.constants[constantName].error || []
        data.constants[constantName].error.push(ALREADY_DEFINED)
      } else {
        data.constants[constantName] = {}
      }

      input = input.replace(regex, '\n')

      let found = false
      let index = 0

      do {
        var result = declaration[index](data.constants[constantName], input)

        found = result.match

        if (found) {
          input = result.input
        }

        ++index
      } while(!found && index < declaration.length)

      log_debug('CONST KEYWORD EXIT')
    }

    return input
  },

  // Manage var keyword (no assign)
  (data, input) => {
    var regex = new re2(/^\s*(export|export\([^\)]+\)|onready\s*)?\s*var\s(\w+)\s*[+\-\/*~]{0,1}\s*\n/)
    
    if (regex.test(input)) {
      log_debug('VAR KEYWORD (NO ASSIGN)')
      var varName = regex.exec(input)[2]

      data.vars = data.vars || {}

      if (data.vars[varName] != null) {
        data.vars[varName].error = data.vars[varName].error || []
        data.vars[varName].error.push(ALREADY_DEFINED)
      } else {
        data.vars[varName] = {}
      }

      input = input.replace(regex, '\n')
      log_debug('VAR KEYWORD EXIT (NO ASSIGN)')
    }

    return input
  },
  
  // Manage var keyword
  (data, input) => {
    var regex = new re2(/^\s*(export|export\([^\)]+\)|onready\s*)?\s*var\s(\w+)\s*[+\-\/*~]{0,1}=\s*/)
    
    if (regex.test(input)) {
      log_debug('VAR KEYWORD')
      var varName = regex.exec(input)[2]

      data.vars = data.vars || {}

      if (data.vars[varName] != null) {
        data.vars[varName].error = data.vars[varName].error || []
        data.vars[varName].error.push(ALREADY_DEFINED)
      } else {
        data.vars[varName] = {}
      }

      input = input.replace(regex, '\n')

      let found = false
      let index = 0

      do {
        var result = declaration[index](data.vars[varName], input)

        found = result.match

        if (found) {
          input = result.input
        }

        ++index
      } while(!found && index < declaration.length)

      log_debug('VAR KEYWORD EXIT')
    }

    return input
  },

  // Manage enum keyword
  (data, input) => {
    var regex = new re2(/^\s*enum\s(\w+)\s*/)
    
    if (regex.test(input)) {
      log_debug('ENUM KEYWORD')
      var enumName = regex.exec(input)[1]

      data.enums = data.enums || {}

      if (data.enums[enumName] != null) {
        data.enums[enumName].error = data.enums[enumName].error || []
        data.enums[enumName].error.push(ALREADY_DEFINED)
      } else {
        data.enums[enumName] = {}
      }

      input = input.replace(regex, '\n')

      let found = false
      let index = 0

      do {
        var result = declaration[index](data.enums[enumName], input)

        found = result.match

        if (found) {
          input = result.input
        }

        ++index
      } while(!found && index < declaration.length)

      log_debug('ENUM KEYWORD EXIT')
    }

    return input
  },
    
  // Manage signal keyword
  (data, input) => {
    var regex = new re2(/^\s*signal\s+([\w]+)\(([\w]+\s*(,\s*[\w]+)*)*\)\s*/)
    
    if (regex.test(input)) {
      log_debug('SIGNAL KEYWORD')
      var signalName = regex.exec(input)[1]

      data.signals = data.signals || {}

      if (data.signals[signalName] != null) {
        data.signals[signalName].error = data.signals[signalName].error || []
        data.signals[signalName].error.push(ALREADY_DEFINED)
      } else {
        data.signals[signalName] = {}
      }

      log_debug('SIGNAL KEYWORD EXIT')
      input = input.replace(regex, '\n')
    }

    return input
  },

  // Manage return keyword
  (data, input) => {
    var regex = new re2(/^\s*return(\s+[^\n]*)\s*/)
    
    if (regex.test(input)) {
      log_debug('RETURN KEYWORD')

      log_debug('RETURN KEYWORD EXIT')
      input = input.replace(regex, '\n')
    }

    return input
  },

  // Manage function call
  (data, input) => {
    var regex = new re2(/^\s*(\.?[\w\[\]'"]+((\.[\w\[\]'"]+)*)\((|.*\s*(,\s*.+)*)\)(\.[\w]+|\((|.*\s*(,\s*.+)*)\))*)\s*\n/)

    if (regex.test(input)) {
      log_debug('FUNCTION CALL')
      var regexResult = regex.exec(input)

      data.call = data.call || []
      data.call.push(regexResult[1])

      input = input.replace(regex, '')
      log_debug('FUNCTION CALL EXIT')
    }

    return input
  },

  // Manage assign keyword
  (data, input) => {
    var regex = new re2(/^\s*((\.?\w|\[['"]?(\.?\w)+['"]?\])+)\s*[+\-\/*~]{0,1}=\s*/)
    
    if (regex.test(input)) {
      log_debug('ASSIGN KEYWORD')
      var regexResult = regex.exec(input)
      var varName = regexResult[1]

      data.vars = data.vars || {}

      if (data.vars[varName] == null) {
        data.vars[varName] = {
          error: [NOT_DEFINED]
        }
      }

      input = input.replace(regex, '\n')

      let found = false
      let index = 0

      do {
        var result = declaration[index](data.vars[varName], input)

        found = result.match

        if (found) {
          input = result.input
        }

        ++index
      } while(!found && index < declaration.length)

      log_debug('ASSIGN KEYWORD EXIT')
    }

    return input
  },
]
const godot_documentation = JSON.parse(parser.toJson(fs.readFileSync(path.resolve(__dirname, '..', 'godot', 'doc', 'base', 'classes.xml'))))

var lint_result = {}
var lint_data = godot_documentation.doc.class.reduce((acc, item) => {
  var methods = {}
  var constants = {}

  if (typeof item.methods == 'object') {
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

  if (typeof item.constants == 'object') {
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

const walkSync = function(dir, filelist) {
  var files = fs.readdirSync(dir)

  filelist = filelist || {}
  files.forEach(function(file) {
    var filepath = path.resolve(dir, file)

    if (fs.statSync(filepath).isDirectory()) {
      filelist = walkSync(filepath, filelist)
    } else if (path.extname(filepath) == '.gd') {
      filelist[filepath.replace(process.cwd(), 'res:/')] = filepath
    }
  })
  return filelist
}

console.log(`Parsing code ...`)

let fileList = walkSync(process.cwd())

Object.keys(fileList).forEach((key) => {
  var filename = fileList[key]
  var fileContent = `${fs.readFileSync(filename).toString()}\n`.replace(/\s*\\\s*\n\s*/gim, ' ').replace(/^(\s*#[^\n]+\n)/gim, '\n')

  let curly = 0
  let bracket = 0
  let parenthesis = 0

  fileContent = fileContent.split("").reduce((acc, item) => {
    switch (item) {
      case '{':
        curly++
        break

      case '}':
        curly--
        break

      case '(':
        parenthesis++
        break

      case ')':
        parenthesis--
        break

      case '[':
        bracket++
        break

      case ']':
        bracket--
        break

      case '\n':
        if (curly > 0 || parenthesis > 0 || bracket > 0) {
          item = ' '
        }
        break
    }

    acc = `${acc}${item}`

    return acc
  }, '')

  lint_result[key] = {
    name: key
  }

  log_debug(`======================================== Parsing new file: ${key}`)

  while (fileContent.length > 0) {
    var oldLength = fileContent.length

    fileContent = keywords.reduce((acc, func) => {
      return func(lint_result[key], acc)
    }, fileContent).replace(/^\s*#[^\n]*/g, '')

    if (oldLength == fileContent.length) {
      console.error(`${key}:\n${fileContent}`)

      process.exit()
    }
  }
})
//console.log(JSON.stringify(lint_result, null, 2))
console.log(`Done!\nAnalyzing code...\n\n`)
const analyzeFunction = function(filename, data, scope, originalFunctionName, nesting) {
  var constants = data.constants || {}
  var variables = data.vars || {}
  var methods = data.methods || {}
  var classes = data.classes || {}
  var arguments = data.arguments || {}
  var bloc = data.bloc || {}
  var inherits = data.inherits || ''
  var parentClass = {}

  if (nesting > 6 && filename != 'res://scripts/http/unirest.gd') {
    log_error(filename, originalFunctionName, `Too nested code bloc ${nesting}`)
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
      log_error(filename, originalFunctionName, `Inheritance error, cannot find original class ${inherits}`)
    }
  }

  // Variable shadowing
  Object.keys(constants).forEach((key) => {
    if (scope[key] != null) {
      log_error(filename, originalFunctionName, `Variable shadowing already defined ${key}`)
    } else if (parentClass[key] != null) {
      log_error(filename, originalFunctionName, `Variable shadowing already defined ${key} in parent class ${inherits}`)
    }else {
      scope[key] = {
        value: constants[key],
        type: 'const'
      }
    }
  })

  Object.keys(variables).forEach((key) => {
    // Guardian clause
    if ((variables[key].error || []).includes(NOT_DEFINED)) {
      return
    }

    if (scope[key] != null) {
      log_error(filename, originalFunctionName, `Variable shadowing already defined ${key}`)
    } else if (parentClass[key] != null && !(parentClass[key].error || []).includes(NOT_DEFINED)) {
      log_error(filename, originalFunctionName, `Variable shadowing already defined ${key} in parent class ${inherits}`)
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
          log_error(filename, originalFunctionName, `Inheritance arguments size mismatch ${key} (inherits: ${inherits})`)
        }
      } else {
        log_error(filename, originalFunctionName, `Variable shadowing already defined ${key}`)
      }
    } else if (parentClass[key] != null) {

      if (parentClass[key].type == 'func') {
        // Skip ignored functions
        if (regExpIgnoreFunctionNames.test(key)) {
          return
        }

        if (parentClass[key].arguments.length != nestedData.arguments.length) {
          log_error(filename, originalFunctionName, `Inheritance arguments size mismatch ${key} (inherits: ${inherits})`)
        }
      } else {
        log_error(filename, originalFunctionName, `Variable shadowing already defined ${key}`)
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

Object.keys(lint_result).forEach((filename) => {
  var fileData = lint_result[filename]

  if (globalScope[filename] == null) {
    globalScope[filename] = {}
    analyzeFunction(filename, fileData, globalScope[filename], null, 0)
  }
})
console.log(`\n\nCode analyzed!`)