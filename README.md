# Universal Development Kit

> Webpack extension which improves universal application development.

:warning: Still in its poc phase

* Starts universal application development fastly (from scratch/without boilerplate)
* Designed on webpack's standard API
* Enhances compilers dependencies: sequential compilation according to dependency graph
* Enhances CLI watching: restarts watching process when webpack config changes

## Implementation

### Class diagram

```
.. tapable ................
: +---------------------+ :
: |       Tapable       |<-------------+
: +---------------------+ :            |
.............^.............            |
             |                         |
.. webpack ..|.........................|...................................
: +---------------------+   +-------------------+   +-------------------+ :
: |    MultiCompiler    |==>|     Compiler      |==>|     Watching      | :
: +---------------------+   +-------------------+   +-------------------+ :
.............^........................^.......................^............
             |                        |                       |
.. udk ......|........................|.......................|............
: +---------------------+   +-------------------+   +-------------------+ :
: |    MultiCompiler    |==>|     Compiler      |==>|     Watching      | :
: +---------------------+   +-------------------+   +-------------------+ :
...........................................................................
```

* [tapable/lib/Tapable](https://github.com/webpack/tapable/blob/df6f2aff44ea06a00000a3a34db2174582597457/lib/Tapable.js)
* [udk/lib/Compiler](https://github.com/enten/udk/blob/e8ff9e6cecf7432b0a6e00ec0d206277e946381d/lib/Compiler.js#L128)
* [udk/lib/MultiCompiler](https://github.com/enten/udk/blob/e8ff9e6cecf7432b0a6e00ec0d206277e946381d/lib/MultiCompiler.js)
* [udk/lib/Watching](https://github.com/enten/udk/blob/e8ff9e6cecf7432b0a6e00ec0d206277e946381d/lib/Compiler.js#L44)
* [webpack/lib/Compiler](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/Compiler.js#L170)
* [webpack/lib/Watching](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/Compiler.js#L17)
* [webpack/lib/MultiCompiler](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/MultiCompiler.js)
