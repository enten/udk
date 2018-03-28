function isCompilerV4 (compiler) {
  return 'hooks' in compiler
}

module.exports = isCompilerV4
