# Universal Angular Application

## Architect Builders

### udk:udk-builder

Build an universal angular application.

| Name | Type | Default | Description |
|------|------|---------|-------------|
| **`browserTarget`** | string | | Target to browser |
| **`serverTarget`** | string | | Target to server |
| `partialBrowserConfig` | string | | Partial webpack config for browser. |
| `partialServerConfig` | string | | Partial webpack config for server. |
| `fileReplacements` | | | Replace files with other files in browser and server. |
| `deleteOutputPath` | boolean | false | Delete the output path before building. |
| `verbose` | boolean | false | Adds more details to output logging. |
| `outputPath` | string | | The full path for the output directory (relative to the current workspace) expected of browser and server targets. Use it to warn when browser or server target output path is outside this output path. Use it to allow nx (@nrwl/workspace) to cache udk build. Don't use it in case of browser and server targets hasn't the same base output path. |
| `generatePackageJson` | boolean | false | Generates a package.json file inside 'outputPath' with a main field to server output main.js. |

### udk:udk-runner

Run an universal angular application.

| Name | Type | Default | Description |
|------|------|---------|-------------|
| **`universalTarget`** | string | | Target to universal |
| `debug` | boolean | | Debug udk dev container |


## Example

Update `angular.json` to configure `build` and `serve` targets with udk-builder.

When udk-builder is configured:

* Run `ng build` to build universal angular project ;
* Run `ng serve` to run universal angular server.

#### angular.json

```diff
diff --git a/angular.json b/angular.json
index 4fcecd1..0097eb6 100644
--- a/angular.json
+++ b/angular.json
@@ -15,9 +15,23 @@
       "prefix": "app",
       "architect": {
         "build": {
+          "builder": "udk:udk-builder",
+          "options": {
+            "browserTarget": "app:browser",
+            "serverTarget": "app:server"
+          },
+          "configurations": {
+            "production": {
+              "browserTarget": "app:browser:production",
+              "serverTarget": "app:server:production",
+              "verbose": true
+            }
+          }
+        },
+        "browser": {
           "builder": "@angular-devkit/build-angular:browser",
           "options": {
-            "outputPath": "dist/app",
+            "outputPath": "dist/app/browser",
             "index": "src/index.html",
             "main": "src/main.ts",
             "polyfills": "src/polyfills.ts",
@@ -63,21 +77,56 @@
             }
           }
         },
+        "server": {
+          "builder": "@angular-devkit/build-angular:server",
+          "options": {
+            "outputPath": "dist/app/server",
+            "main": "src/server.ts",
+            "bundleDependencies": false,
+            "tsConfig": "tsconfig.server.json",
+            "sourceMap": {
+              "scripts": true,
+              "styles": false
+            }
+          },
+          "configurations": {
+            "production": {
+              "fileReplacements": [
+                {
+                  "replace": "src/environments/environment.ts",
+                  "with": "src/environments/environment.prod.ts"
+                }
+              ],
+              "outputHashing": "media"
+            }
+          }
+        },
         "serve": {
+          "builder": "udk:udk-runner",
+          "options": {
+            "universalTarget": "app:build"
+          },
+          "configurations": {
+            "spa": {
+              "universalTarget": "app:build:spa"
+            }
+          }
+        },
+        "serve-spa": {
           "builder": "@angular-devkit/build-angular:dev-server",
           "options": {
-            "browserTarget": "app:build"
+            "browserTarget": "app:browser"
           },
           "configurations": {
             "production": {
-              "browserTarget": "app:build:production"
+              "browserTarget": "app:browser:production"
             }
           }
         },
         "extract-i18n": {
           "builder": "@angular-devkit/build-angular:extract-i18n",
           "options": {
-            "browserTarget": "app:build"
+            "browserTarget": "app:browser"
           }
         },
         "test": {
@@ -114,11 +163,11 @@
           "builder": "@angular-devkit/build-angular:protractor",
           "options": {
             "protractorConfig": "e2e/protractor.conf.js",
-            "devServerTarget": "app:serve"
+            "devServerTarget": "app:serve-spa"
           },
           "configurations": {
             "production": {
-              "devServerTarget": "app:serve:production"
+              "devServerTarget": "app:serve-spa:production"
             }
           }
         }
```
