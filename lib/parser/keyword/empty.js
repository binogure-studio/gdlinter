module.exports = (data, input, parsingItems) => {
  return input.replace(/(^\s*|\n\s*)\n/g, '\n')
}
