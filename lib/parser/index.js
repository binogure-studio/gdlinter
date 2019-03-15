const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const directories = fs.readdirSync(__dirname)

function loadSync (jsPath) {
  const files = fs.readdirSync(jsPath)

  return files.reduce((js, filename) => {
    const filePath = path.join(jsPath, filename)
    const extname = path.extname(filePath)

    if (fs.statSync(filePath).isFile() && /^\.js$/i.test(extname)) {
      js.push(require(filePath))
    }

    return js
  }, [])
}

const parsingItems = directories
  .reduce((acc, directory) => {
    let filepath = path.join(__dirname, directory)

    if (fs.statSync(filepath).isDirectory()) {
      acc[directory] = loadSync(filepath)
    }

    return acc
  }, {})

const walkSync = function (dir, filelist) {
  var files = fs.readdirSync(dir)

  filelist = filelist || {}
  files.forEach(function (file) {
    var filepath = path.resolve(dir, file)

    if (fs.statSync(filepath).isDirectory()) {
      filelist = walkSync(filepath, filelist)
    } else if (path.extname(filepath) == '.gd') {
      filelist[filepath.replace(process.cwd(), 'res:/')] = filepath
    }
  })
  return filelist
}

module.exports = () => {
  var parsed_data = {}

  console.log(`Parsing code ...`)

  let fileList = walkSync(process.cwd())

  Object.keys(fileList).forEach((key) => {
    var filename = fileList[key]
    var fileContent = `${fs.readFileSync(filename).toString()}\n`.replace(/\s*\\\s*\n\s*/gim, ' ').replace(/^(\s*#[^\n]+\n)/gim, '\n')

    let curly = 0
    let bracket = 0
    let parenthesis = 0

    fileContent = fileContent.split('').reduce((acc, item) => {
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

    parsed_data[key] = {
      name: key
    }

    console.debug(`======================================== Parsing new file: ${key}`)

    while (fileContent.length > 0) {
      var oldLength = fileContent.length

      fileContent = parsingItems.keyword.reduce((acc, func) => func(parsed_data[key], acc, parsingItems), fileContent).replace(/^\s*#[^\n]*/g, '')

      if (oldLength == fileContent.length) {
        console.error(`${key}:\n${fileContent}`)

        process.exit()
      }
    }
  })

  return parsed_data
}
