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
const webpackOptionsSchema = require("webpack/schemas/webpackOptionsSchema.json");

function webpack(options, callback) {
	const webpackOptionsValidationErrors = validateSchema(webpackOptionsSchema, options);
	if(webpackOptionsValidationErrors.length) {
		throw new WebpackOptionsValidationError(webpackOptionsValidationErrors);
	}
	let compiler;
	if(Array.isArray(options)) {
		compiler = new MultiCompiler(options.map(options => webpack(options)));
	} else if(typeof options === "object") {
		// TODO webpack 4: process returns options
		new WebpackOptionsDefaulter().process(options);

		compiler = new Compiler();
		compiler.context = options.context;
		compiler.options = options;
		new NodeEnvironmentPlugin().apply(compiler);
		if(options.plugins && Array.isArray(options.plugins)) {
			compiler.apply.apply(compiler, options.plugins);
		}
		compiler.applyPlugins("environment");
		compiler.applyPlugins("after-environment");
		compiler.options = new WebpackOptionsApply().process(options, compiler);
	} else {
		throw new Error("Invalid argument: options");
	}
	if(callback) {
		if(typeof callback !== "function") throw new Error("Invalid argument: callback");
		if(options.watch === true || (Array.isArray(options) && options.some(o => o.watch))) {
			const watchOptions = Array.isArray(options) ? options.map(o => o.watchOptions || {}) : (options.watchOptions || {});
			return compiler.watch(watchOptions, callback);
		}
		compiler.run(callback);
	}
	return compiler;
}
exports = module.exports = webpack;

webpack.WebpackOptionsDefaulter = WebpackOptionsDefaulter;
webpack.WebpackOptionsApply = WebpackOptionsApply;
webpack.Compiler = Compiler;
webpack.MultiCompiler = MultiCompiler;
webpack.NodeEnvironmentPlugin = NodeEnvironmentPlugin;
webpack.validate = validateSchema.bind(this, webpackOptionsSchema);
webpack.validateSchema = validateSchema;
webpack.WebpackOptionsValidationError = WebpackOptionsValidationError;

function exportPlugins(obj, mappings) {
	Object.keys(mappings).forEach(name => {
		Object.defineProperty(obj, name, {
			configurable: false,
			enumerable: true,
			get: mappings[name]
		});
	});
}

exportPlugins(exports, {
	"DefinePlugin": () => require("webpack/lib/DefinePlugin"),
	"NormalModuleReplacementPlugin": () => require("webpack/lib/NormalModuleReplacementPlugin"),
	"ContextReplacementPlugin": () => require("webpack/lib/ContextReplacementPlugin"),
	"ContextExclusionPlugin": () => require("webpack/lib/ContextExclusionPlugin"),
	"IgnorePlugin": () => require("webpack/lib/IgnorePlugin"),
	"WatchIgnorePlugin": () => require("webpack/lib/WatchIgnorePlugin"),
	"BannerPlugin": () => require("webpack/lib/BannerPlugin"),
	"PrefetchPlugin": () => require("webpack/lib/PrefetchPlugin"),
	"AutomaticPrefetchPlugin": () => require("webpack/lib/AutomaticPrefetchPlugin"),
	"ProvidePlugin": () => require("webpack/lib/ProvidePlugin"),
	"HotModuleReplacementPlugin": () => require("webpack/lib/HotModuleReplacementPlugin"),
	"SourceMapDevToolPlugin": () => require("webpack/lib/SourceMapDevToolPlugin"),
	"EvalSourceMapDevToolPlugin": () => require("webpack/lib/EvalSourceMapDevToolPlugin"),
	"EvalDevToolModulePlugin": () => require("webpack/lib/EvalDevToolModulePlugin"),
	"CachePlugin": () => require("webpack/lib/CachePlugin"),
	"ExtendedAPIPlugin": () => require("webpack/lib/ExtendedAPIPlugin"),
	"ExternalsPlugin": () => require("webpack/lib/ExternalsPlugin"),
	"JsonpTemplatePlugin": () => require("webpack/lib/JsonpTemplatePlugin"),
	"LibraryTemplatePlugin": () => require("webpack/lib/LibraryTemplatePlugin"),
	"LoaderTargetPlugin": () => require("webpack/lib/LoaderTargetPlugin"),
	"MemoryOutputFileSystem": () => require("webpack/lib/MemoryOutputFileSystem"),
	"ProgressPlugin": () => require("webpack/lib/ProgressPlugin"),
	"SetVarMainTemplatePlugin": () => require("webpack/lib/SetVarMainTemplatePlugin"),
	"UmdMainTemplatePlugin": () => require("webpack/lib/UmdMainTemplatePlugin"),
	"NoErrorsPlugin": () => require("webpack/lib/NoErrorsPlugin"),
	"NoEmitOnErrorsPlugin": () => require("webpack/lib/NoEmitOnErrorsPlugin"),
	"NewWatchingPlugin": () => require("webpack/lib/NewWatchingPlugin"),
	"EnvironmentPlugin": () => require("webpack/lib/EnvironmentPlugin"),
	"DllPlugin": () => require("webpack/lib/DllPlugin"),
	"DllReferencePlugin": () => require("webpack/lib/DllReferencePlugin"),
	"LoaderOptionsPlugin": () => require("webpack/lib/LoaderOptionsPlugin"),
	"NamedModulesPlugin": () => require("webpack/lib/NamedModulesPlugin"),
	"NamedChunksPlugin": () => require("webpack/lib/NamedChunksPlugin"),
	"HashedModuleIdsPlugin": () => require("webpack/lib/HashedModuleIdsPlugin"),
	"ModuleFilenameHelpers": () => require("webpack/lib/ModuleFilenameHelpers")
});
exportPlugins(exports.optimize = {}, {
	"AggressiveMergingPlugin": () => require("webpack/lib/optimize/AggressiveMergingPlugin"),
	"AggressiveSplittingPlugin": () => require("webpack/lib/optimize/AggressiveSplittingPlugin"),
	"CommonsChunkPlugin": () => require("webpack/lib/optimize/CommonsChunkPlugin"),
	"ChunkModuleIdRangePlugin": () => require("webpack/lib/optimize/ChunkModuleIdRangePlugin"),
	"DedupePlugin": () => require("webpack/lib/optimize/DedupePlugin"),
	"LimitChunkCountPlugin": () => require("webpack/lib/optimize/LimitChunkCountPlugin"),
	"MinChunkSizePlugin": () => require("webpack/lib/optimize/MinChunkSizePlugin"),
	"ModuleConcatenationPlugin": () => require("webpack/lib/optimize/ModuleConcatenationPlugin"),
	"OccurrenceOrderPlugin": () => require("webpack/lib/optimize/OccurrenceOrderPlugin"),
	"UglifyJsPlugin": () => require("webpack/lib/optimize/UglifyJsPlugin")
});
