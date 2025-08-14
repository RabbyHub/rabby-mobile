const posterName = `__rabbyPostMessageToProvider${Math.random().toString(36).substr(2, 9)}`;
const posterRef = `window['${posterName}']`;
/**
 * @tip for WeakSet, reference https://caniuse.com/?search=WeakSet
 * @tip safeJsonStringifyReplacer trim these:
 *  - circular references
 *  - __react, maybe from rsc hydration
 *  - BigInt, convert to string with 'n' suffix
 */
export const BROWSER_SCRIPT_BASE = `
;(function () {
  if (!${posterRef}) {
    var safeJsonStringifyReplacer = (function () {
      var cache = new WeakSet();
      return function (key, value) {
        if (key.indexOf('__reactFiber') === 0) return 'TRIMED';
        if (typeof value === 'object' && value !== null) {
          if (cache.has(value)) return;
          cache.add(value);
        }
        if (typeof value === 'bigint') {
          return value.toString() + 'n';
        }
        return value;
      };
    })();

    ${posterRef} = function (content, pos) {
      if (typeof content !== 'object') content = { primitive: content };

      pos = pos || 'unknown';
      var jsonString = "";

      try {
        jsonString = JSON.stringify(content, safeJsonStringifyReplacer)
      } catch (e) {
        jsonString = JSON.stringify({
          type: 'BROWSER_SCRIPT_ERR_CAPTURED',
          payload: {
            message: e.message,
            stack: e.stack,
            position: pos,
          }
        });
      }

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(jsonString);
      }
    };
  }
})();
`;

export const SPA_urlChangeListener = `;(function () {
  var __rabbyHistory = window.history;
  var __rabbyPushState = __rabbyHistory.pushState;
  var __rabbyReplaceState = __rabbyHistory.replaceState;
  function __rabby__updateUrl() {
    var siteNameMeta = document.querySelector('head > meta[property="og:site_name"]');
    var siteName = siteNameMeta ? siteNameMeta.getAttribute('content') : '';
    var title = (function () {
      var titleMeta = document.querySelector('head > meta[name="title"]');
      return titleMeta ? titleMeta.getAttribute('content') : '';
    })() || document.title;

    ${posterRef}({
      type: 'NAV_CHANGE',
      payload: {
        url: location.href,
        title: title,
        ogSiteName: siteName,
      }
    }, 'NAV_CHANGE');

    setTimeout(() => {
      var height = Math.max(document.documentElement.clientHeight, document.documentElement.scrollHeight, document.body.clientHeight, document.body.scrollHeight);
      ${posterRef}({
        type: 'GET_HEIGHT',
        payload: {
          height: height
        }
      }, 'GET_HEIGHT');
    }, 500);
  }

  __rabbyHistory.pushState = function(state) {
    setTimeout(function () {
      __rabby__updateUrl();
    }, 100);
    return __rabbyPushState.apply(history, arguments);
  };

  __rabbyHistory.replaceState = function(state) {
    setTimeout(function () {
      __rabby__updateUrl();
    }, 100);
    return __rabbyReplaceState.apply(history, arguments);
  };

  window.onpopstate = function(event) {
    __rabby__updateUrl();
  };
  })();
`;

export const JS_WINDOW_INFORMATION = `
  ;(function () {
    var shortcutIcon = window.document.querySelector('head > link[rel="shortcut icon"]');
    var icon = shortcutIcon || Array.from(window.document.querySelectorAll('head > link[rel="icon"]')).find((icon) => Boolean(icon.href));

    var siteName = document.querySelector('head > meta[property="og:site_name"]');
    var title = siteName || document.querySelector('head > meta[name="title"]');
    ${posterRef}({
      type: 'GET_TITLE_FOR_BOOKMARK',
      payload: {
        title: title ? title.content : document.title,
        url: location.href,
        icon: icon && icon.href
      }
    }, 'GET_TITLE_FOR_BOOKMARK');
  })();
`;

export const JS_DESELECT_TEXT = `if (window.getSelection) {window.getSelection().removeAllRanges();}
else if (document.selection) {document.selection.empty();}`;

export const JS_POST_MESSAGE_TO_PROVIDER = (message: string, origin: string) => `(function () {
  try {
    window.postMessage(${JSON.stringify(message)}, '${origin}');
  } catch (e) {
    // Nothing to do
    console.warn('[rabby-post-message-to-provider]', e);
  }
})()`;

export const JS_IFRAME_POST_MESSAGE_TO_PROVIDER = (message: string, origin: string) =>
  `(function () {})()`;
/** Disable sending messages to iframes for now
 *
`(function () {
  const iframes = document.getElementsByTagName('iframe');
  for (let frame of iframes){

      try {
        frame.contentWindow.postMessage(${JSON.stringify(message)}, '${origin}');
      } catch (e) {
        // Nothing to do
        console.warn('[rabby-iframe-post-message-to-provider]', e);
      }

  }
})()`;
 */
