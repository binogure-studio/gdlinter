const re2 = require('re2')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^\s*class\s+([\w]+)\s*(extends\s+([^\n]+)\s*)?:\s*\n/)

  if (regex.test(input)) {
    console.debug('CLASS KEYWORD')
    var regexResult = regex.exec(input)
    var className = regexResult[1].replace(/['"]/g, '')
    var parentClass = (regexResult[3] || '').replace(/['"]/g, '')

    data.classes = data.classes || {}

    data.classes[className] = {
      name: className,
      inherits: parentClass
    }

    var classSelect = new re2(/^\s*class\s+([\w]+)\s*(extends\s+([^\n]+)\s*)?:\s*\n( {2}\s*[^\n]*\n|\s*\n)+/)
    var classCore = classSelect.exec(input)[0].replace(regex, '')

    while (classCore.length > 0) {
      let oldLength = classCore.length

      classCore = parsingItems.keyword.reduce(
        (acc, func) => func(data.classes[className], acc, parsingItems),
        classCore).replace(/^\s*#[^\n]*/g, '')

      if (oldLength == classCore.length) {
        console.error(`${classCore}`)

        process.exit()
      }
    }

    input = input.replace(classSelect, '')
    console.debug('CLASS KEYWORD EXIT')
  }

  return input
}
