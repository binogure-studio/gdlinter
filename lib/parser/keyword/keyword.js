module.exports = (data, input, parsingItems) => input.replace(/^\s*(continue|break|pass)\s*\n/g, '\n')
