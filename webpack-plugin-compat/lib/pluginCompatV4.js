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
const {
	HookMap,
	SyncHook,
	SyncBailHook,
	SyncWaterfallHook,
	AsyncParallelHook,
	AsyncParallelBailHook,
	AsyncSeriesHook,
	AsyncSeriesWaterfallHook
} = require("tapable");

function canonicalizeName(name) {
	return name.replace(/[- ]([a-zA-Z])/g, str => str.substr(1).toUpperCase());
}
function getHook(obj, name) {
	// Special case for 'parser'
	if (name === 'parser' && (obj.hooks.parser instanceof HookMap)) {
		return obj.hooks.parser.for('javascript/auto');
	}
	var hook = obj.hooks[canonicalizeName(name)];
	if (hook && !(hook instanceof HookMap)) {
		return hook;
	}
	const mapParts = name.split(' '), hookParts = [];
	while (mapParts.length > 1) {
		hookParts.splice(0, 0, mapParts.splice(-1, 1));
		const hookMap = obj.hooks[canonicalizeName(mapParts.join(' '))];
		if (hookMap && (hookMap instanceof HookMap)) {
			return hookMap.for(canonicalizeName(hookParts.join(' ')));
		}
	}
};

function reg(obj, a1, a2) {
	var events = a1;
	if (typeof a1 === 'string') {
		events = {};
		events[a1] = a2;
	}
	events = Object.keys(events).map(key => [key, events[key]]);
	events.forEach(event => {
		var name = event[0];
		if (!obj.hooks) {
			obj.hooks = {};
		}
		name = canonicalizeName(name);
		const hook = getHook(obj, name);
		if (hook) {
			throw new Error(`Hook ${name} already registered`);
		}
		const hookType = event[1][0];
		const args = event.slice(1);
		switch(hookType) {
			case "Sync": obj.hooks[name] = new SyncHook(args); break;
			case "SyncBail" : obj.hooks[name] = new SyncBailHook(args); break;
			case "SyncWaterfall" : obj.hooks[name] = new SyncWaterfallHook(args); break;
			case "AsyncParallel" : obj.hooks[name] = new AsyncParallelHook(args); break;
			case "AsyncParallelBail" : obj.hooks[name] = new AsyncParallelBailHook(args); break;
			case "AsyncSeries" : obj.hooks[name] = new AsyncSeriesHook(args); break;
			case "AsyncSeriesWaterfall" : obj.hooks[name] = new AsyncSeriesWaterfallHook(args); break;
			default: {
				throw new Error(`Unsupported hook type ${hookType}`);
			};
		}
	});
}

function tap(obj, a1, a2, a3, a4) {
	var events = a1, context = a2, options = a3;
	if (typeof a1 === 'string' || Array.isArray(a1) && a1.every(e => typeof e === 'string')) {
		events = [[a1, a2]];
		context = a3;
		options = a4;
	} else if (!Array.isArray(a1)) {
		events = Object.keys(events).map(key => [key, events[key]]);
	}
	events.forEach(event => {
		var names = event[0];
		if (!Array.isArray(names)) {
			names = [names];
		}
		names.forEach(name => {
			const hook = getHook(obj, name);
			if (!hook) {
				throw new Error(`No hook for ${name} in object ${obj.constructor.name}`);
			}
			var method = "tap";
			var callback = context ? event[1].bind(context) : event[1];
			if (hook.constructor.name.startsWith("Async")) {
				method = "tapAsync";
			}
			var pluginName = this.pluginName;
			if (!pluginName) {
				throw new Error("No plugin name provided");
			}
			if (options) {
				pluginName = Object.assign({}, options);
				pluginName.name = this.pluginName;
			}
			hook[method](pluginName, callback);
		});
	});
}

function callHook(hookClass, obj, name, ...args) {
	const hook = getHook(obj, name);
	if (!hook) {
		throw new Error(`No hook for ${name} in object ${obj.constructor.name}`);
	}
	if (!(hookClass.prototype ? hook instanceof hookClass : hook.constructor.name === hookClass.name)) {
		throw new Error(`Attempt to call ${hook.constructor.name} from a ${hookClass.name} call`);
	}
	const method = hookClass.name.startsWith("Async") ? "callAsync" : "call";
	return hook[method](...args);
}

const common = {
	Tapable: class {},
	reg: reg,
	callSync(obj, ...args) {
		return callHook(SyncHook, obj, ...args);
	},
	callSyncWaterfall(obj, ...args) {
		return callHook(SyncWaterfallHook, obj, ...args);
	},
	callSyncBail(obj, ...args) {
		return callHook(SyncBailHook, obj, ...args);
	},
	callAsyncSeries(obj, ...args) {
		return callHook(AsyncSeriesHook, obj, ...args);
	},
	callAsyncSeriesWaterfall(obj, ...args) {
		return callHook(AsyncSeriesWaterfallHook, obj, ...args);
	},
	callAsyncParallel(obj, ...args) {
		return callHook(AsyncParallelHook, obj, ...args);
	},
	callAsyncParallelBail(obj, ...args) {
		return callHook(AsyncParallelBailHook, obj, ...args);
	}
};

module.exports = Object.assign({}, common, {
	for: function(pluginName) {
		return Object.assign({}, common, {
			tap: tap.bind({pluginName: pluginName})
		});
	}
});
