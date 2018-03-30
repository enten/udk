let webpack

if ('version' in require('webpack/lib/webpack')) {
	webpack = require('./webpack.v4')
} else {
	webpack = require('./webpack.v3')
}

module.exports = webpack