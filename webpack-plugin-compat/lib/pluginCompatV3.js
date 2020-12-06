/*
 * (C) Copyright HCL Technologies Ltd. 2018
 * (C) Copyright IBM Corp. 2012, 2017 All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const Tapable = require("tapable");

function tap(obj, a1, a2, a3) {
	var events = a1, context = a2;
	if (typeof a1 === 'string' || Array.isArray(a1) && a1.every(e => typeof e === 'string')) {
		events = [[a1, a2]];
		context = a3;
	} else if (!Array.isArray(a1)) {
		events = Object.keys(events).map(key => [key, events[key]]);
	}
	events.forEach(event => {
		var callback = context ? event[1].bind(context) : event[1];
		obj.plugin(event[0], callback);
	});
}

const common = {
	Tapable: Tapable,
	reg() {},
	callSync(obj, ...args) {
		return obj.applyPlugins(...args);
	},
	callSyncWaterfall(obj, ...args) {
		return obj.applyPluginsWaterfall(...args);
	},
	callSyncBail(obj, ...args) {
		return obj.applyPluginsBailResult(...args);
	},
	callAsyncSeries(obj, ...args) {
		return obj.applyPluginsAsyncSeries(...args);
	},
	callAsyncSeriesWaterfall(obj, ...args) {
		return obj.applyPluginsAsyncWaterfall(...args);
	},
	callAsyncParallel(obj, ...args) {
		return obj.applyPluginsParallel(...args);
	},
	callAsyncParallelBail(obj, ...args) {
		return obj.applyPluginsParallelBailResult(...args);
	}
};

module.exports = Object.assign({}, common, {
	for: function() {
		return Object.assign({}, common, {
			tap:tap
		});
	}
});
