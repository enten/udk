## Implementation

### Compatibility

| udk | webpack3 | webpack4 | angular-devkit |
|-----|----------|----------|----------------|
| v1.1.11-rc.0 |  | v4.44.2 | v0.1100.3 |
| v1.1.10 |  |  | v0.1000.0 |
| v1.1.9 |  |  | v0.901.7 |
| v1.1.9-rc.1 |  |  | v0.900.0-rc.6 |
| v1.1.7 |  |  | v8.2.0 |
| v1.1.6 |  |  | v8.1.0 |
| v1.1.4 |  |  | v8.1.0-rc.0 |
| v1.1.1 |  |  | v8.1.0-beta.2 |
| v1.1.0 |  |  | v8.0.0-beta.2 |
| v1.0.3 |  |  | v0.14.0-beta.1 |
| v1.0.2 |  |  | v0.12.1 |
| v1.0.1 |  |  | v0.12.0 |
| v1.0.0 |  |  | v0.11.0 |
| v1.0.0-alpha.2 | v3.12.0 | v4.21.0 | v0.10.2 |
| v0.3.17 |  |  | v0.8.0-beta.0 |
| v0.3.15 |  |  | v0.7.0-rc.2 |
| v0.3.14 |  |  | v0.7.0 |
| v0.3.13 |  |  | v0.6.0 |
| [v0.3.0](https://github.com/enten/udk/tree/v0.3.0) | [v3.11.0](https://github.com/webpack/webpack/tree/v3.11.0) | [v4.4.1](https://github.com/webpack/webpack/tree/v4.4.1) |
| [v0.2.4](https://github.com/enten/udk/tree/v0.2.4) | [v3.5.5](https://github.com/webpack/webpack/tree/v3.5.5) | - |

## Files

### [bin](https://github.com/enten/udk/tree/dev/bin)

* [udk.ts](../bin/udk.ts)
* [udk-webpack.ts](../bin/udk-webpack.ts) ([test](../test/bin/udk-webpack_spec.ts))
    * [udk-webpack3.ts](../bin/udk-webpack3.ts) ([test](../test/bin/udk-webpack3_spec.ts)) `<` [webpack@3.11.0/bin/webpack.js](https://github.com/webpack/webpack/blob/v3.11.0/bin/webpack.js)
    * [udk-webpack4.ts](../bin/udk-webpack4.ts) `<` [webpack@4.4.1/bin/webpack.js](https://github.com/webpack/webpack/blob/v4.4.1/bin/webpack.js)
    * [udk-webpack-cli.ts](../bin/udk-webpack-cli.ts) ([test](../test/bin/udk-webpack-cli_spec.ts)) `<` [webpack-cli@3.1.0/bin/cli.js](https://github.com/webpack/webpack-cli/blob/v.3.1.0/bin/cli.js)
    * [udk-webpack-command.ts](../bin/udk-webpack-command.ts) ([test](../test/bin/udk-webpack-command_spec.ts)) `<` [webpack-command@0.4.1/lib/cli.js](https://github.com/webpack-contrib/webpack-command/blob/v0.4.1/lib/cli.js)
* [udkc.ts](../bin/udkc.ts)
* [udk-dev-container.ts](../bin/udk-dev-container.ts) ([test](../test/bin/udk-dev-container_spec.ts))

### [lib](https://github.com/enten/udk/tree/dev/lib)

* **[MultiCompiler.ts](../lib/MultiCompiler.ts)** `<` [webpack@4.4.1/lib/MultiCompiler.js](https://github.com/webpack/webpack/blob/v4.4.1/lib/MultiCompiler.js)
* [devContainer.ts](../lib/devContainer.ts) ([test](../test/lib/devContainer_spec.ts))
* [index.ts](../lib/index.ts) ([test](../test/lib/index_spec.ts))
* [webpack-api.d.ts](../lib/webpack-api.d.ts)
* [webpack.ts](../lib/webpack.ts) ([test](../test/lib/webpack_spec.ts))
    * [webpack.v3.ts](../lib/webpack.v3.ts) `<` [webpack@3.11.0/lib/webpack.js](https://github.com/webpack/webpack/blob/v3.11.0/lib/webpack.js)
    * [webpack.v4.ts](../lib/webpack.v4.ts) `<` [webpack@4.4.1/lib/webpack.js](https://github.com/webpack/webpack/blob/v4.4.1/lib/webpack.js)

### [lib/util](https://github.com/enten/udk/tree/dev/lib/util)

* [configLoader.ts](../lib/util/configLoader.ts) ([test](../test/lib/util/configLoader_spec.ts))
* [container.ts](../lib/util/container.ts) ([test](../test/lib/util/container_spec.ts))
* [decorateEventListener.ts](../lib/util/decorateEventListener.ts) ([test](../test/lib/util/decorateEventListener_spec.ts))
* [decorateRequestListener.ts](../lib/util/decorateRequestListener.ts) ([test](../test/lib/util/decorateRequestListener_spec.ts))
* [ensureConfigHasEntry.ts](../lib/util/ensureConfigHasEntry.ts) ([test](../test/lib/util/ensureConfigHasEntry_spec.ts))
* [ensureConfigHasPlugin.ts](../lib/util/ensureConfigHasPlugin.ts) ([test](../test/lib/util/ensureConfigHasPlugin_spec.ts))
* [existsModule.ts](../lib/util/existsModule.ts) ([test](../test/lib/util/existsModule_spec.ts))
* [getEntryOutputPathFromStats.ts](../lib/util/getEntryOutputPathFromStats.ts) ([test](../test/lib/util/getEntryOutputPathFromStats_spec.ts))
* [getOutputPublicPath.ts](../lib/util/getOutputPublicPath.ts) ([test](../test/lib/util/getOutputPublicPath_spec.ts))
* [hookResolveFilename.ts](../lib/util/hookResolveFilename.ts) ([test](../test/lib/util/hookResolveFilename_spec.ts))
* [index.ts](../lib/util/index.ts) ([test](../test/lib/util/index_spec.ts))
* [packageVersion.ts](../lib/util/packageVersion.ts) ([test](../test/lib/util/packageVersion_spec.ts))
* [requireModule.ts](../lib/util/requireModule.ts) ([test](../test/lib/util/requireModule_spec.ts))


### Class diagram

```
┌┄ tapable ┄┄┄┄┄┄┄┄┄┄┄┄┄┐
┆ ┌───────────────────┐ ┆
┆ |      Tapable      |<────────────┐
┆ └─────────Λ─────────┘ ┆           │
└┄┄┄┄┄┄┄┄┄┄┄│┄┄┄┄┄┄┄┄┄┄┄┘           │
            │                       │
┌┄ webpack ┄│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐
┆ ┌─────────┴─────────┐   ┌─────────┴─────────┐   ┌───────────────────┐ ┆
┆ |   MultiCompiler   ├──>|     Compiler      ├──>|     Watching      | ┆
┆ └─────────Λ─────────┘   └─────────Λ─────────┘   └───────────────────┘ ┆
└┄┄┄┄┄┄┄┄┄┄┄║┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘
            ║                       │
┌┄ udk ┄┄┄┄┄║┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐
┆ ┌─────────╨─────────┐   ┌─────────┴─────────┐   ┌───────────────────┐ ┆
┆ |   MultiCompiler   |<──┤   DevContainer    ╞══>|     Container     | ┆
┆ └───────────────────┘   └───────────────────┘   └───────────────────┘ ┆
└┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘

┄┄┄┄ package
──── module
═══> extend relation
───> 0..n relation
```


* [tapable/lib/Tapable](https://github.com/webpack/tapable/blob/v1.0.0/lib/Tapable.js)
* **[udk/lib/MultiCompiler](https://github.com/enten/udk/blob/v0.3.0/lib/MultiCompiler.js)**
* **[udk/lib/devContainer](../lib/devContainer.ts)**
* **[udk/lib/util/container](../lib/util/container.ts)**
* [webpack/lib/Compiler](https://github.com/webpack/webpack/blob/v4.4.1/lib/Compiler.js)
* [webpack/lib/MultiCompiler](https://github.com/webpack/webpack/blob/v4.4.1/lib/MultiCompiler.js)
* [webpack/lib/Watching](https://github.com/webpack/webpack/blob/v4.4.1/lib/Watching.js)
