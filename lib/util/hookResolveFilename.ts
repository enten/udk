// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import Module = require('module');

import debug = require('debug');

export interface IModuleStatic {
  _resolveFilename: ModuleFilenameResolver;
}

export type ModuleFilenameResolver = (
  request: string,
  parent: Module,
  isMain: boolean,
  options?: ModuleFilenameResolverOptions | null,
) => string;

export type ModuleFilenameResolverHook = (
  request: string,
  parent: Module,
  isMain: boolean,
  options: ModuleFilenameResolverOptions | null | undefined,
  previousResolver: ModuleFilenameResolver,
) => string;

export interface ModuleFilenameResolverOptions {
  paths?: string[];
}

export interface ModuleRequestAlias {
  fromFile: string;
  replaceRequest: string;
  withRequest: string;
}

export type RemoveModuleFilenameResolverHookFn = () => void;

export const ModuleStatic = Module as Partial<IModuleStatic> as IModuleStatic;

export const nativeModuleResolveFilename = ModuleStatic._resolveFilename;

export let moduleResolveFilename = nativeModuleResolveFilename;
const dbg = debug('udk:resolve');

export function aliasModuleResolveFilename(alias: ModuleRequestAlias) {
  return hookModuleResolveFilename(resolveModuleRequestAlias.bind(null, alias));
}

export function disableModuleResolveFilenameHook() {
  ModuleStatic._resolveFilename = nativeModuleResolveFilename;
}

export function enableModuleResolveFilenameHook() {
  ModuleStatic._resolveFilename = (request, parent, isMain, options) => {
    return moduleResolveFilename(request, parent, isMain, options);
  };
}

export function hookModuleResolveFilename(
  hook: ModuleFilenameResolverHook,
): RemoveModuleFilenameResolverHookFn {
  const previousResolver = moduleResolveFilename;
  let hookRemoved = false;

  moduleResolveFilename = (request, parent, isMain, options) => {
    if (hookRemoved) {
      return previousResolver(request, parent, isMain, options);
    }

    return hook(request, parent, isMain, options, previousResolver);
  };

  return () => {
    hookRemoved = true;
  };
}

export function resolveModuleRequestAlias(
  alias: ModuleRequestAlias,
  request: string,
  parent: Module,
  isMain: boolean,
  options: { paths: string[] } | null | undefined,
  previousResolver: ModuleFilenameResolver,
) {
  if (request === alias.replaceRequest) {
    const parentId = previousResolver(parent.id, parent, isMain, options);
    const fromFile = previousResolver(alias.fromFile, parent, isMain, options);

    if (parentId === fromFile) {
      const withRequest = previousResolver(alias.withRequest, parent, isMain, options);

      dbg('alias hook %O', {
        alias,
        fromFile,
        replaceRequest: alias.replaceRequest,
        withRequest,
        request,
        parentId: parentId,
      });

      return withRequest;
    }
  }

  return previousResolver(request, parent, isMain, options);
}
