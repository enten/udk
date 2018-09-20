## FAQ

### What is udk?

A webpack extension which improves multi compiler behavior to ensure dependency between configs.

### What are differences in multi compiler behavior with webpack?

The only difference between udk and webpack is the [MultiCompiler](../lib/MultiCompiler.ts):

* Invalidate compiler dependants when a compiler done ;
* Interupt compilation if a compiler dependency has stats errors ;
* Wait compiler dependency done when a shared file is updated.

[webpack/lib/MultiCompiler](https://github.com/webpack/webpack/blob/master/lib/MultiCompiler.js) don't do that.

For example, in watch mode, if a shared file between two compilers changed, the two compilers will run without caring of dependencies between compilers.

Generally, the server compiler run faster (because we don't bundle external dependencies) and may need assets or stats from another compiler dependency to run or achieve its hot module reloading.

We tried some ways to achieve that (base on compiler plugin). Finally,
the most elegant way to ensure compiler dependencies was to extend multi compiler ([~350 SLOC](../lib/MultiCompiler.ts)).

### Should I need to install webpack?

Yes, you need to install the webpack version which suits you.

udk declares webpack as a peer dependency.

### Which webpack versions are supported?

Webpack v3 and v4.

### What are differences between udk cli and webpack cli?

No differences.

udk are based on webpack cli (we only hook webpack resolution to use [udk multi compiler](https://github.com/webpack/webpack/blob/master/lib/MultiCompiler.js) instead of [webpack multi compiler](https://github.com/webpack/webpack/blob/master/lib/MultiCompiler.js)).

### Can I use [webpack-command](https://github.com/webpack-contrib/webpack-command) instead of [webpack-cli](https://github.com/webpack/webpack-cli)?

Yes you can.

udk support webpack-cli and webpack-command.

**Please note that [webpack-command is deprecated](https://github.com/webpack-contrib/webpack-command#user-content-webpack-command) since september 2018.**

### What is the dev container?

A process which run a webpack compiler in a child process and enable HMR on browser and server sides if the node bundle entrypoint export an http server.

See [dev-container.md](./dev-container.md) for details.

### Why some files aren't tested?

Three files are just a plain copy from webpack package:

* [bin/udk-webpack4.ts](../bin/udk-webpack4.ts)
* [lib/webpack.v3.ts](../lib/webpack.v3.ts) ; 
* [lib/webpack.v4.ts](../lib/webpack.v4.ts).

Two files are hard to test and doesn't bring real features:

* [bin/udk.ts](../bin/udk.ts) ;
* [bin/udkc.ts](../bin/udkc.ts).

Three files aren't a part of udk core:

* [angular/lib/devContainer.ts](../angular/lib/devContainer.ts) ;
* [angular/lib/ng-devkit.ts](../angular/lib/ng-devkit.ts) ;
* [angular/lib/udk-builder.ts](../angular/lib/udk-builder.ts).

For others, we try to have a 100% coverage constraint.
