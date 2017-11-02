#!/usr/bin/env node

try {
	var localUdkc = require.resolve(path.join(process.cwd(), "node_modules", "udk", "bin", "udkc.js"));
	if(__filename !== localUdkc) {
		return require(localUdkc);
	}
} catch(e) {}

const devContainer = require('../lib/devContainer')

devContainer.apply(null, process.argv.slice(2)).run()
