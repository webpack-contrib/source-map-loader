function testLoader(content, sourceMap) {
  const result = { code: content };

  if (sourceMap) {
    result.map = sourceMap;
  }

  return `export default ${JSON.stringify(result)}`;
}

module.exports = testLoader;
