let webpack

if ('version' in require('webpack/lib/webpack')) {
	console.log('V4!!!!')
	webpack = require('./webpack.v4')
} else {
	console.log('v3!!!!')
	webpack = require('./webpack.v3')
}

module.exports = webpack