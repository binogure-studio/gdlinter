const re2 = require('re2')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^\s*(static\s*)?func\s+(\w+)\(\s*(\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*(\s*,\s*\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*)*)*\)(\.\(\s*(\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*(\s*,\s*\w+(\s*=\s*[\w\[\]\{\}\_\."'\-]+)*)*)*\)){0,1}\s*:\s*\n/)

  while (regex.test(input)) {
    console.debug('FUNC KEYWORD')
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

      methodCore = parsingItems.keyword.reduce(
        (acc, func) => func(data.methods[methodName], acc, parsingItems),
        methodCore).replace(/^\s*#[^\n]*/g, '')

      if (oldLength == methodCore.length) {
        console.error(`${methodCore}`)

        process.exit()
      }
    }

    input = input.replace(methodSelect, '')
    console.debug('FUNC KEYWORD EXIT')
  }


  return input
}