const re2 = require('re2')

module.exports = (data, input, parsingItems) => {
  var regex = new re2(/^(\s{2,})(if|else|elif|while|for)(\s+[^\n]+)?\s*:\n/)

  while (regex.test(input)) {
    console.debug('IF/ELIF/ELSE/FOR/WHILE KEYWORDS')
    var regexResult = regex.exec(input)
    var spacePad = `${regexResult[1].replace(/\n/, '')}`
    var regexStr = `^${spacePad}((if|else|elif|while|for)(\\s+[^\\n]+)?)\\s*:\\s*\\n(${spacePad}  [^\\n]+\\n|\\s*\\n)+`
    var blocRegEx = new re2(regexStr)
    var blocRegexResult = blocRegEx.exec(input.replace(/^\s*\n+/, ''))

    if (blocRegexResult == null) {
      console.debug('IF/ELIF/ELSE/FOR/WHILE KEYWORDS EXIT (NO MATCH)')
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

      blocCore = parsingItems.keyword.reduce(
        (acc, func) => func(data.bloc[blocName], acc, parsingItems),
        blocCore).replace(/^\s*#[^\n]*/g, '')

      if (oldLength == blocCore.length) {
        console.error(`${blocCore}`)
        process.exit()
      }
    }

    console.debug('IF/ELIF/ELSE/FOR/WHILE KEYWORDS EXIT')
  }

  return input
}
