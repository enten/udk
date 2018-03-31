/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const Compiler = require("webpack/lib/Compiler");
const MultiCompiler = require("./MultiCompiler");
const NodeEnvironmentPlugin = require("webpack/lib/node/NodeEnvironmentPlugin");
const WebpackOptionsApply = require("webpack/lib/WebpackOptionsApply");
const WebpackOptionsDefaulter = require("webpack/lib/WebpackOptionsDefaulter");
const validateSchema = require("webpack/lib/validateSchema");
const WebpackOptionsValidationError = require("webpack/lib/WebpackOptionsValidationError");
const webpackOptionsSchema = require("webpack/schemas/WebpackOptions.json");
const RemovedPluginError = require("webpack/lib/RemovedPluginError");
const version = require("webpack/package.json").version;

const webpack = (options, callback) => {
	const webpackOptionsValidationErrors = validateSchema(
		webpackOptionsSchema,
		options
	);
	if (webpackOptionsValidationErrors.length) {
		throw new WebpackOptionsValidationError(webpackOptionsValidationErrors);
	}
	let compiler;
	if (Array.isArray(options)) {
		compiler = new MultiCompiler(options.map(options => webpack(options)));
	} else if (typeof options === "object") {
		options = new WebpackOptionsDefaulter().process(options);

		compiler = new Compiler(options.context);
		compiler.options = options;
		new NodeEnvironmentPlugin().apply(compiler);
		if (options.plugins && Array.isArray(options.plugins)) {
			for (const plugin of options.plugins) {
				plugin.apply(compiler);
			}
		}
		compiler.hooks.environment.call();
		compiler.hooks.afterEnvironment.call();
		compiler.options = new WebpackOptionsApply().process(options, compiler);
	} else {
		throw new Error("Invalid argument: options");
	}
	if (callback) {
		if (typeof callback !== "function")
			throw new Error("Invalid argument: callback");
		if (
			options.watch === true ||
			(Array.isArray(options) && options.some(o => o.watch))
		) {
			const watchOptions = Array.isArray(options)
				? options.map(o => o.watchOptions || {})
				: options.watchOptions || {};
			return compiler.watch(watchOptions, callback);
		}
		compiler.run(callback);
	}
	return compiler;
};

exports = module.exports = webpack;
exports.version = version;

webpack.WebpackOptionsDefaulter = WebpackOptionsDefaulter;
webpack.WebpackOptionsApply = WebpackOptionsApply;
webpack.Compiler = Compiler;
webpack.MultiCompiler = MultiCompiler;
webpack.NodeEnvironmentPlugin = NodeEnvironmentPlugin;
webpack.validate = validateSchema.bind(this, webpackOptionsSchema);
webpack.validateSchema = validateSchema;
webpack.WebpackOptionsValidationError = WebpackOptionsValidationError;

const exportPlugins = (obj, mappings) => {
	for (const name of Object.keys(mappings)) {
		Object.defineProperty(obj, name, {
			configurable: false,
			enumerable: true,
			get: mappings[name]
		});
	}
};

exportPlugins(exports, {
	AutomaticPrefetchPlugin: () => require("webpack/lib/AutomaticPrefetchPlugin"),
	BannerPlugin: () => require("webpack/lib/BannerPlugin"),
	CachePlugin: () => require("webpack/lib/CachePlugin"),
	ContextExclusionPlugin: () => require("webpack/lib/ContextExclusionPlugin"),
	ContextReplacementPlugin: () => require("webpack/lib/ContextReplacementPlugin"),
	DefinePlugin: () => require("webpack/lib/DefinePlugin"),
	Dependency: () => require("webpack/lib/Dependency"),
	DllPlugin: () => require("webpack/lib/DllPlugin"),
	DllReferencePlugin: () => require("webpack/lib/DllReferencePlugin"),
	EnvironmentPlugin: () => require("webpack/lib/EnvironmentPlugin"),
	EvalDevToolModulePlugin: () => require("webpack/lib/EvalDevToolModulePlugin"),
	EvalSourceMapDevToolPlugin: () => require("webpack/lib/EvalSourceMapDevToolPlugin"),
	ExtendedAPIPlugin: () => require("webpack/lib/ExtendedAPIPlugin"),
	ExternalsPlugin: () => require("webpack/lib/ExternalsPlugin"),
	HashedModuleIdsPlugin: () => require("webpack/lib/HashedModuleIdsPlugin"),
	HotModuleReplacementPlugin: () => require("webpack/lib/HotModuleReplacementPlugin"),
	IgnorePlugin: () => require("webpack/lib/IgnorePlugin"),
	LibraryTemplatePlugin: () => require("webpack/lib/LibraryTemplatePlugin"),
	LoaderOptionsPlugin: () => require("webpack/lib/LoaderOptionsPlugin"),
	LoaderTargetPlugin: () => require("webpack/lib/LoaderTargetPlugin"),
	MemoryOutputFileSystem: () => require("webpack/lib/MemoryOutputFileSystem"),
	Module: () => require("webpack/lib/Module"),
	ModuleFilenameHelpers: () => require("webpack/lib/ModuleFilenameHelpers"),
	NamedChunksPlugin: () => require("webpack/lib/NamedChunksPlugin"),
	NamedModulesPlugin: () => require("webpack/lib/NamedModulesPlugin"),
	NoEmitOnErrorsPlugin: () => require("webpack/lib/NoEmitOnErrorsPlugin"),
	NormalModuleReplacementPlugin: () =>
		require("webpack/lib/NormalModuleReplacementPlugin"),
	PrefetchPlugin: () => require("webpack/lib/PrefetchPlugin"),
	ProgressPlugin: () => require("webpack/lib/ProgressPlugin"),
	ProvidePlugin: () => require("webpack/lib/ProvidePlugin"),
	SetVarMainTemplatePlugin: () => require("webpack/lib/SetVarMainTemplatePlugin"),
	SingleEntryPlugin: () => require("webpack/lib/SingleEntryPlugin"),
	SourceMapDevToolPlugin: () => require("webpack/lib/SourceMapDevToolPlugin"),
	Stats: () => require("webpack/lib/Stats"),
	Template: () => require("webpack/lib/Template"),
	UmdMainTemplatePlugin: () => require("webpack/lib/UmdMainTemplatePlugin"),
	WatchIgnorePlugin: () => require("webpack/lib/WatchIgnorePlugin")
});
exportPlugins((exports.optimize = {}), {
	AggressiveMergingPlugin: () => require("webpack/lib/optimize/AggressiveMergingPlugin"),
	AggressiveSplittingPlugin: () =>
		require("webpack/lib/optimize/AggressiveSplittingPlugin"),
	ChunkModuleIdRangePlugin: () =>
		require("webpack/lib/optimize/ChunkModuleIdRangePlugin"),
	LimitChunkCountPlugin: () => require("webpack/lib/optimize/LimitChunkCountPlugin"),
	MinChunkSizePlugin: () => require("webpack/lib/optimize/MinChunkSizePlugin"),
	ModuleConcatenationPlugin: () =>
		require("webpack/lib/optimize/ModuleConcatenationPlugin"),
	OccurrenceOrderPlugin: () => require("webpack/lib/optimize/OccurrenceOrderPlugin"),
	RuntimeChunkPlugin: () => require("webpack/lib/optimize/RuntimeChunkPlugin"),
	SideEffectsFlagPlugin: () => require("webpack/lib/optimize/SideEffectsFlagPlugin"),
	SplitChunksPlugin: () => require("webpack/lib/optimize/SplitChunksPlugin")
});
exportPlugins((exports.web = {}), {
	FetchCompileWasmTemplatePlugin: () =>
		require("webpack/lib/web/FetchCompileWasmTemplatePlugin"),
	JsonpTemplatePlugin: () => require("webpack/lib/web/JsonpTemplatePlugin")
});
exportPlugins((exports.webworker = {}), {
	WebWorkerTemplatePlugin: () => require("webpack/lib/webworker/WebWorkerTemplatePlugin")
});
exportPlugins((exports.node = {}), {
	NodeTemplatePlugin: () => require("webpack/lib/node/NodeTemplatePlugin"),
	ReadFileCompileWasmTemplatePlugin: () =>
		require("webpack/lib/node/ReadFileCompileWasmTemplatePlugin")
});
exportPlugins((exports.debug = {}), {
	ProfilingPlugin: () => require("webpack/lib/debug/ProfilingPlugin")
});
exportPlugins((exports.util = {}), {
	createHash: () => require("webpack/lib/util/createHash")
});

const defineMissingPluginError = (namespace, pluginName, errorMessage) => {
	Object.defineProperty(namespace, pluginName, {
		configurable: false,
		enumerable: true,
		get() {
			throw new RemovedPluginError(errorMessage);
		}
	});
};

// TODO remove in webpack 5
defineMissingPluginError(
	exports.optimize,
	"UglifyJsPlugin",
	"webpack.optimize.UglifyJsPlugin has been removed, please use config.optimization.minimize instead."
);

// TODO remove in webpack 5
defineMissingPluginError(
	exports.optimize,
	"CommonsChunkPlugin",
	"webpack.optimize.CommonsChunkPlugin has been removed, please use config.optimization.splitChunks instead."
);
