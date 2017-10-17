#!/usr/bin/env node

try {
	var localUdkc = require.resolve(path.join(process.cwd(), "node_modules", "udk", "bin", "udkc.js"));
	if(__filename !== localUdkc) {
		return require(localUdkc);
	}
} catch(e) {}

const devContainer = require('../lib/devContainer')

let uconfigPath
let udkc

if (process.argv.length > 2) {
  uconfigPath = process.argv[2]
}

udkc = devContainer(uconfigPath)

udkc.run()
