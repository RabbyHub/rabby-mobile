(function installRabbyI18nLivePreview(global) {
  if (!global || global.__RABBY_I18N_LIVE_PREVIEW_BOOTED__) {
    return;
  }

  var config = '__RABBY_I18N_LIVE_PREVIEW_CONFIG__';
  var missingValueMarker = { __missing: true };
  var state = (global.__RABBY_I18N_LIVE_PREVIEW__ =
    global.__RABBY_I18N_LIVE_PREVIEW__ || {
      applied: {},
      baseline: {},
      commandVersion: 0,
      config: config,
      deviceId: '',
      inFlight: false,
      lastError: null,
      lastSnapshotHash: '',
      pendingSnapshotSync: false,
      pristineSnapshotByLocale: {},
      timer: null,
    });

  global.__RABBY_I18N_LIVE_PREVIEW_BOOTED__ = true;
  state.config = config;

  function log() {
    if (!config.debug || !global.console || !console.log) {
      return;
    }

    var args = ['[i18n-live-preview]'];
    for (var index = 0; index < arguments.length; index += 1) {
      args.push(arguments[index]);
    }
    console.log.apply(console, args);
  }

  function warn() {
    if (!global.console || !console.warn) {
      return;
    }

    var args = ['[i18n-live-preview]'];
    for (var index = 0; index < arguments.length; index += 1) {
      args.push(arguments[index]);
    }
    console.warn.apply(console, args);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function cloneValue(value) {
    if (value === undefined || value === null || typeof value !== 'object') {
      return value;
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_error) {
      return value;
    }
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return '';
    }
  }

  function normalizeBaseUrl(rawUrl) {
    var fallback = 'http://127.0.0.1:8765/api/v1';
    if (!rawUrl || typeof rawUrl !== 'string') {
      return fallback;
    }

    var trimmed = rawUrl.replace(/\/+$/, '');
    if (trimmed.slice(-6) === '/rules') {
      return trimmed.slice(0, -6);
    }

    if (trimmed.indexOf('/api/v1') !== -1) {
      return trimmed;
    }

    return trimmed + '/api/v1';
  }

  config.apiBaseUrl = normalizeBaseUrl(config.apiBaseUrl || config.endpointUrl);

  function getI18n() {
    if (state.i18n && typeof state.i18n.t === 'function') {
      return state.i18n;
    }

    if (
      global.__RABBY_I18N__ &&
      typeof global.__RABBY_I18N__.t === 'function'
    ) {
      state.i18n = global.__RABBY_I18N__;
      return state.i18n;
    }

    if (typeof global.__r === 'function' && config.i18nModuleId !== null) {
      try {
        var imported = global.__r(config.i18nModuleId);
        var candidate =
          imported && imported.__esModule ? imported.default : imported;

        if (
          candidate &&
          candidate.default &&
          typeof candidate.default.t === 'function'
        ) {
          candidate = candidate.default;
        }

        if (candidate && typeof candidate.t === 'function') {
          state.i18n = candidate;
          return candidate;
        }
      } catch (error) {
        warn('failed to resolve i18n module', error && error.message);
      }
    }

    return null;
  }

  function getNamespaceRoot(i18n, locale) {
    var store =
      i18n &&
      i18n.services &&
      i18n.services.resourceStore &&
      i18n.services.resourceStore.data;

    if (!store) {
      return null;
    }

    if (!store[locale]) {
      store[locale] = {};
    }

    if (!store[locale][config.namespace]) {
      store[locale][config.namespace] = {};
    }

    return store[locale][config.namespace];
  }

  function setDeepValue(target, key, value) {
    var parts = String(key).split('.');
    var cursor = target;

    for (var index = 0; index < parts.length - 1; index += 1) {
      var part = parts[index];
      if (!cursor[part] || typeof cursor[part] !== 'object') {
        cursor[part] = {};
      }
      cursor = cursor[part];
    }

    cursor[parts[parts.length - 1]] = value;
  }

  function deleteDeepValue(target, key) {
    var parts = String(key).split('.');
    var cursor = target;

    for (var index = 0; index < parts.length - 1; index += 1) {
      cursor = cursor && cursor[parts[index]];
      if (!cursor || typeof cursor !== 'object') {
        return;
      }
    }

    if (!cursor || typeof cursor !== 'object') {
      return;
    }

    delete cursor[parts[parts.length - 1]];
  }

  function rememberBaseline(i18n, locale, key) {
    if (!state.baseline[locale]) {
      state.baseline[locale] = {};
    }

    if (hasOwn(state.baseline[locale], key)) {
      return;
    }

    var currentValue = i18n.getResource(locale, config.namespace, key);
    state.baseline[locale][key] =
      currentValue === undefined
        ? missingValueMarker
        : cloneValue(currentValue);
  }

  function restoreBaseline(i18n, locale, key) {
    if (!state.baseline[locale] || !hasOwn(state.baseline[locale], key)) {
      return;
    }

    var namespaceRoot = getNamespaceRoot(i18n, locale);
    if (!namespaceRoot) {
      return;
    }

    var baselineValue = state.baseline[locale][key];
    if (baselineValue === missingValueMarker) {
      deleteDeepValue(namespaceRoot, key);
      return;
    }

    setDeepValue(namespaceRoot, key, cloneValue(baselineValue));
  }

  function markTouched(touchedLocales, locale) {
    touchedLocales[locale] = true;
  }

  function buildNextAppliedMap(patches) {
    var nextApplied = {};

    for (var index = 0; index < patches.length; index += 1) {
      var patch = patches[index];
      if (
        !patch ||
        !patch.locale ||
        !patch.key ||
        typeof patch.value !== 'string'
      ) {
        continue;
      }

      if (!nextApplied[patch.locale]) {
        nextApplied[patch.locale] = {};
      }

      nextApplied[patch.locale][patch.key] = patch.value;
    }

    return nextApplied;
  }

  function notifyI18n(i18n, touchedLocales) {
    var locales = Object.keys(touchedLocales);
    if (!locales.length) {
      return;
    }

    try {
      if (typeof i18n.emit === 'function') {
        var loadedPayload = {};
        for (var index = 0; index < locales.length; index += 1) {
          loadedPayload[locales[index]] = {};
          loadedPayload[locales[index]][config.namespace] = true;
        }
        i18n.emit('loaded', loadedPayload);
        if (i18n.language) {
          i18n.emit('languageChanged', i18n.language);
        }
      }
    } catch (error) {
      warn('failed to notify i18n listeners', error && error.message);
    }
  }

  function applyPatchPayload(patches) {
    var i18n = getI18n();
    if (!i18n) {
      warn('i18n instance is not ready');
      return false;
    }

    var nextApplied = buildNextAppliedMap(patches);
    var previousApplied = state.applied || {};
    var touchedLocales = {};
    var localeMap = {};

    Object.keys(previousApplied).forEach(function (locale) {
      localeMap[locale] = true;
    });
    Object.keys(nextApplied).forEach(function (locale) {
      localeMap[locale] = true;
    });

    Object.keys(localeMap).forEach(function (locale) {
      var previousLocaleRules = previousApplied[locale] || {};
      var nextLocaleRules = nextApplied[locale] || {};

      Object.keys(previousLocaleRules).forEach(function (key) {
        if (hasOwn(nextLocaleRules, key)) {
          return;
        }

        restoreBaseline(i18n, locale, key);
        markTouched(touchedLocales, locale);
      });

      Object.keys(nextLocaleRules).forEach(function (key) {
        if (previousLocaleRules[key] === nextLocaleRules[key]) {
          return;
        }

        rememberBaseline(i18n, locale, key);

        var namespaceRoot = getNamespaceRoot(i18n, locale);
        if (!namespaceRoot) {
          return;
        }

        setDeepValue(namespaceRoot, key, nextLocaleRules[key]);
        markTouched(touchedLocales, locale);
      });
    });

    state.applied = nextApplied;
    notifyI18n(i18n, touchedLocales);
    return true;
  }

  function getResourceStoreData(i18n) {
    return (
      i18n &&
      i18n.services &&
      i18n.services.resourceStore &&
      i18n.services.resourceStore.data
    );
  }

  function captureNewPristineLocales() {
    var i18n = getI18n();
    if (!i18n) {
      return null;
    }

    var store = getResourceStoreData(i18n);
    if (!store) {
      return null;
    }

    var newSnapshotByLocale = {};

    Object.keys(store).forEach(function (locale) {
      var namespaceRoot = store[locale] && store[locale][config.namespace];
      if (
        namespaceRoot &&
        typeof namespaceRoot === 'object' &&
        !state.pristineSnapshotByLocale[locale]
      ) {
        state.pristineSnapshotByLocale[locale] = cloneValue(namespaceRoot);
        newSnapshotByLocale[locale] = cloneValue(namespaceRoot);
      }
    });

    return {
      currentLocale: i18n.language || '',
      newSnapshotByLocale: newSnapshotByLocale,
      snapshotHash: safeStringify(state.pristineSnapshotByLocale),
    };
  }

  function buildRegisterPayload() {
    var snapshotState = captureNewPristineLocales();
    var i18n = getI18n();
    if (!snapshotState || !i18n) {
      return null;
    }

    state.lastSnapshotHash = snapshotState.snapshotHash;

    return {
      appName: 'RabbyMobile',
      currentLocale: snapshotState.currentLocale,
      deviceId: state.deviceId,
      deviceName:
        config.deviceName ||
        'RabbyMobile ' +
          (state.deviceId ? state.deviceId.slice(0, 6) : 'device'),
      namespace: config.namespace,
      platform:
        (global.navigator && navigator.product) ||
        (global.HermesInternal ? 'hermes' : 'react-native'),
      snapshotByLocale: cloneValue(state.pristineSnapshotByLocale),
    };
  }

  function buildHeartbeatPayload() {
    var snapshotState = captureNewPristineLocales();
    var i18n = getI18n();
    if (!i18n) {
      return null;
    }

    return {
      currentLocale:
        (snapshotState && snapshotState.currentLocale) || i18n.language || '',
      newSnapshotByLocale:
        (snapshotState && snapshotState.newSnapshotByLocale) || {},
    };
  }

  function requestJson(url, init) {
    var abortController =
      typeof AbortController === 'function' ? new AbortController() : null;
    var timeoutId = abortController
      ? setTimeout(function () {
          abortController.abort();
        }, config.requestTimeoutMs)
      : null;

    return fetch(
      url,
      Object.assign({}, init || {}, {
        headers: Object.assign(
          {
            Accept: 'application/json',
          },
          init && init.body ? { 'Content-Type': 'application/json' } : {},
          init && init.headers ? init.headers : {},
        ),
        signal: abortController ? abortController.signal : undefined,
      }),
    ).finally(function () {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }

  function fetchJson(url, init) {
    return requestJson(url, init).then(function (response) {
      if (response.status === 304) {
        return { notModified: true };
      }

      if (!response.ok) {
        return response
          .json()
          .catch(function () {
            return { error: 'HTTP ' + response.status };
          })
          .then(function (body) {
            throw new Error(body.error || 'HTTP ' + response.status);
          });
      }

      return response.json();
    });
  }

  function scheduleNextPoll(delayMs) {
    if (state.timer) {
      clearTimeout(state.timer);
    }

    state.timer = setTimeout(function () {
      syncWithServer();
    }, delayMs || config.pollIntervalMs);
  }

  function syncWithServer() {
    if (state.inFlight) {
      scheduleNextPoll(config.pollIntervalMs);
      return;
    }

    var i18n = getI18n();
    if (!i18n || typeof fetch !== 'function') {
      scheduleNextPoll(1000);
      return;
    }

    state.inFlight = true;

    var registerPromise;
    if (!state.deviceId) {
      var newId =
        'device-' +
        Date.now().toString(36) +
        '-' +
        Math.random().toString(36).slice(2, 8);
      state.deviceId = newId;
    }

    if (!state.registered) {
      var registerPayload = buildRegisterPayload();
      if (!registerPayload) {
        state.inFlight = false;
        scheduleNextPoll(1000);
        return;
      }

      registerPromise = fetchJson(config.apiBaseUrl + '/devices/register', {
        body: JSON.stringify(registerPayload),
        method: 'POST',
      }).then(function (payload) {
        state.registered = true;
        state.deviceId = payload.deviceId || state.deviceId;
        state.commandVersion = payload.version || 0;
        applyPatchPayload(
          Array.isArray(payload.patches) ? payload.patches : [],
        );
      });
    } else {
      registerPromise = Promise.resolve();
    }

    registerPromise
      .then(function () {
        var heartbeatPayload = buildHeartbeatPayload();
        if (!heartbeatPayload) {
          return null;
        }

        return fetchJson(
          config.apiBaseUrl +
            '/devices/' +
            encodeURIComponent(state.deviceId) +
            '/heartbeat',
          {
            body: JSON.stringify(heartbeatPayload),
            method: 'POST',
          },
        );
      })
      .then(function () {
        return fetchJson(
          config.apiBaseUrl +
            '/devices/' +
            encodeURIComponent(state.deviceId) +
            '/commands?since=' +
            encodeURIComponent(String(state.commandVersion || 0)),
        );
      })
      .then(function (payload) {
        if (!payload || payload.notModified) {
          return;
        }

        if (typeof payload.version === 'number') {
          state.commandVersion = payload.version;
        }

        applyPatchPayload(
          Array.isArray(payload.patches) ? payload.patches : [],
        );
        state.lastError = null;
        log('synced device', state.deviceId, 'version', state.commandVersion);
      })
      .catch(function (error) {
        state.lastError = error ? String(error.message || error) : 'unknown';
        warn('sync failed', state.lastError);
      })
      .then(function () {
        state.inFlight = false;
        scheduleNextPoll(config.pollIntervalMs);
      });
  }

  log('booted', config.apiBaseUrl);
  syncWithServer();
  /* eslint-disable no-undef */
})(typeof globalThis !== 'undefined' ? globalThis : this);
/* eslint-enable no-undef */
