const fs = require('fs');
const path = require('path');

let createDefaultMetroSerializer;

try {
  ({
    createDefaultMetroSerializer,
  } = require('@sentry/react-native/dist/js/tools/vendor/metro/utils'));
} catch (_error) {
  const baseJSBundleModule = require('metro/src/DeltaBundler/Serializers/baseJSBundle');
  const bundleToStringModule = require('metro/src/lib/bundleToString');

  const baseJSBundle =
    typeof baseJSBundleModule === 'function'
      ? baseJSBundleModule
      : baseJSBundleModule.baseJSBundle || baseJSBundleModule.default;
  const bundleToString =
    typeof bundleToStringModule === 'function'
      ? bundleToStringModule
      : bundleToStringModule.bundleToString || bundleToStringModule.default;

  createDefaultMetroSerializer = () => {
    return (entryPoint, preModules, graph, options) => {
      const bundle = baseJSBundle(entryPoint, preModules, graph, options);
      return bundleToString(bundle).code;
    };
  };
}

const projectRoot = path.resolve(__dirname, '../..');
const i18nModulePath = path.resolve(projectRoot, 'src/utils/i18n.ts');
const runtimeTemplate = fs.readFileSync(
  path.join(__dirname, 'runtime-template.js'),
  'utf8',
);
const runtimeConfigPlaceholderPattern =
  /(['"])__RABBY_I18N_LIVE_PREVIEW_CONFIG__\1|__RABBY_I18N_LIVE_PREVIEW_CONFIG__/;

function normalizeResult(result) {
  if (typeof result === 'string') {
    return { code: result, map: undefined, stringResult: !0 };
  }

  return { code: result.code, map: result.map, stringResult: !1 };
}

function denormalizeResult(result) {
  if (result.stringResult) {
    return result.code;
  }

  return { code: result.code, map: result.map };
}

function getEnvNumber(name, fallback) {
  const rawValue = process.env[name];
  const parsed = Number(rawValue);

  if (!rawValue || !Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function getEnvString(name, fallback) {
  const rawValue = process.env[name];
  if (typeof rawValue !== 'string') {
    return fallback;
  }

  const trimmed = rawValue.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed.toLowerCase() === 'null'
  ) {
    return fallback;
  }

  return trimmed;
}

function resolveI18nModuleId(graph, createModuleId) {
  if (typeof createModuleId !== 'function') {
    return null;
  }

  for (const dependency of graph.dependencies.values()) {
    if (dependency.path === i18nModulePath) {
      return createModuleId(dependency.path);
    }
  }

  return null;
}

function renderRuntime(config) {
  const rendered = runtimeTemplate.replace(
    runtimeConfigPlaceholderPattern,
    JSON.stringify(config),
  );

  if (rendered === runtimeTemplate) {
    throw new Error(
      'Failed to inject i18n live preview config into runtime template',
    );
  }

  return rendered;
}

function injectIntoBundle(bundleCode, injectedCode) {
  const sourceMapComment = bundleCode.lastIndexOf('//# sourceMappingURL=');

  if (sourceMapComment !== -1) {
    return (
      bundleCode.slice(0, sourceMapComment) +
      `${injectedCode}\n` +
      bundleCode.slice(sourceMapComment)
    );
  }

  const debugIdComment = bundleCode.lastIndexOf('//# debugId=');

  if (debugIdComment !== -1) {
    return (
      bundleCode.slice(0, debugIdComment) +
      `${injectedCode}\n` +
      bundleCode.slice(debugIdComment)
    );
  }

  return `${bundleCode}\n${injectedCode}`;
}

function createInjectedConfig(graph, options) {
  return {
    endpointUrl: getEnvString(
      'I18N_LIVE_PREVIEW_URL',
      'https://live-preview-five.vercel.app/api/v1',
    ),
    pollIntervalMs: getEnvNumber('I18N_LIVE_PREVIEW_POLL_MS', 3000),
    requestTimeoutMs: getEnvNumber('I18N_LIVE_PREVIEW_TIMEOUT_MS', 10000),
    namespace: getEnvString('I18N_LIVE_PREVIEW_NAMESPACE', 'translations'),
    debug: !['0', 'false'].includes(
      (process.env.I18N_LIVE_PREVIEW_DEBUG || '').toLowerCase(),
    ),
    i18nModuleId: resolveI18nModuleId(graph, options.createModuleId),
  };
}

function createI18nLivePreviewSerializer({ upstreamSerializer } = {}) {
  const serializer = upstreamSerializer || createDefaultMetroSerializer();

  return async function i18nLivePreviewSerializer(
    entryPoint,
    preModules,
    graph,
    options,
  ) {
    const serializerResult = await serializer(
      entryPoint,
      preModules,
      graph,
      options,
    );

    const normalized = normalizeResult(serializerResult);
    const injectedConfig = createInjectedConfig(graph, options);
    const injectedCode = renderRuntime(injectedConfig);

    normalized.code = injectIntoBundle(normalized.code, injectedCode);

    return denormalizeResult(normalized);
  };
}

module.exports = {
  createI18nLivePreviewSerializer,
};
