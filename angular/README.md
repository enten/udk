# Universal Angular Application

## udk:udk-builder

### Overview

> Build an universal angular application with udk.

### Options

| Name | Type | Default | Description |
|------|------|---------|-------------|
| **`browserTarget`** | string | | Target to browser |
| **`serverTarget`** | string | | Target to server |
| `partialBrowserConfig` | string | | Partial webpack config for browser. |
| `partialServerConfig` | string | | Partial webpack config for server. |
| `fileReplacements` | | | Replace files with other files in browser and server. |
| `deleteOutputPath` | boolean | false | Delete the output path before building |
| `verbose` | boolean | false | Adds more details to output logging. |

### Example

#### Run universal build

```
ng run ng-universal:udk
```

#### angular.json

```diff
{
  "$schema": "./node_modules/@angular-devkit/core/src/workspace/workspace-schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "ng-universal": {
      "root": "",
      "projectType": "application",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "verbose": true
          },
          "configurations": {
            "production": {
              "verbose": false
            }
          }
        },
        "server": {
          "builder": "@angular-devkit/build-angular:server",
          "options": {
            "verbose": true
          },
          "configurations": {
            "production": {
              "verbose": false
            }
          }
        },
+       "udk": {
+         "builder": "udk:udk-builder",
+         "options": {
+           "browserTarget": "ng-universal:build",
+           "serverTarget": "ng-universal:server"
+         },
+         "configurations": {
+           "production": {
+             "browserTarget": "ng-universal:build:production",
+             "serverTarget": "ng-universal:server:production",
+             "verbose": true
+           }
+         }
+       },
      }
    }
  }
}

```

## NgContainer

Run a [dev container](../docs/dev-container.md) throught [angular-cli](https://github.com/angular/angular-cli/).

### Usage

```shell
npx ng-udkc --project <udk-target>
```

### Example

#### Run dev container

```shell
npx ng-udkc --config
```

#### udk.container.js

```js
module.exports = {
  context: __dirname,
  angularProject: 'ng-universal:udk',
  hmr: true,
  metafiles: [
    __filename,
    'angular.json',
    'package.json',
    'src/tsconfig.app.json',
    'src/tsconfig.browser.json',
    'src/tsconfig.server.json',
    'src/index.html',
    'src/main.server.ts',
    'tsconfg.json'
  ],
};
```
