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
| `deleteOutputPath` | boolean | false | Delete the output path before building. |
| `fileLoaderEmitFile` | boolean | false | File loader emit file. |
| `verbose` | boolean | false | Adds more details to output logging. |

### Example

#### Run universal build

```
ng run app:udk
```

#### angular.json

```diff
{
  "$schema": "./node_modules/@angular-devkit/core/src/workspace/workspace-schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "app": {
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
+           "browserTarget": "app:build",
+           "serverTarget": "app:server"
+         },
+         "configurations": {
+           "production": {
+             "browserTarget": "app:build:production",
+             "serverTarget": "app:server:production",
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
npx ng-udkc [--project <udk-target>]
```

### Example

#### Run dev container

```shell
npx ng-udkc --project app:udk
```
