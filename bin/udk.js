#!/usr/bin/env node

let webpack

if ('version' in require('webpack/lib/webpack')) {
	webpack = require('./udk.webpack4')
} else {
	webpack = require('./udk.webpack3')
}

module.exports = webpack