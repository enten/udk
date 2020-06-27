/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
	Version 7b07a8d on Mar 28, 2020
*/
/*globals __resourceQuery */
if (module.hot) {
	var hotPollInterval = +__resourceQuery.substr(1) || 10 * 60 * 1000;
	var log = require("webpack/hot/log");

	var checkForUpdate = function checkForUpdate(fromUpdate) {
		if (module.hot.status() === "idle") {
			module.hot
				.check(true)
				.then(function (updatedModules) {
					if (!updatedModules) {
						if (fromUpdate) log("info", "[HMR] Update applied.");
						return;
					}
					require("webpack/hot/log-apply-result")(updatedModules, updatedModules);
					checkForUpdate(true);
				})
				.catch(function (err) {
					var status = module.hot.status();
					if (["abort", "fail"].indexOf(status) >= 0) {
						log("warning", "[HMR] Cannot apply update.");
						log("warning", "[HMR] " + (log.formatError ? log.formatError(err) : (err.stack || err.message)));
						log("warning", "[HMR] You need to restart the application!");
						// <udk patch>
						if (process.send) {
							log("warning", "[udk] restarting the application...");
							process.send({ action: 'run' });
						}
						// </udk patch>
					} else {
						log("warning", "[HMR] Update failed: " + (log.formatError ? log.formatError(err) : (err.stack || err.message)));
					}
				});
		}
	};
	setInterval(checkForUpdate, hotPollInterval);
} else {
	throw new Error("[HMR] Hot Module Replacement is disabled.");
}
