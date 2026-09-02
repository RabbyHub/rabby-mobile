const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
function randString(length = 10, str = '') {
  let result = '';
  for (let i = 0, rnum: number; i < length; ++i) {
    rnum = Math.floor(Math.random() * chars.length);
    result += chars.charAt(rnum);
  }
  return `${result}${str}`;
}
const objRefs = {
  poster: `window['${randString(5, '__rabbyPostMessageToProvider')}']`,
  getWinInfo: `window['${randString(5, '__rabbyGetWindowInformation')}']`,
};

export const RABBY_DECLARED_PREFIX = 'RD::';
export const RABBY_DECLARED_TYPES = {
  NAV_CHANGE: `${RABBY_DECLARED_PREFIX}NAV_CHANGE`,
  GET_HEIGHT: `${RABBY_DECLARED_PREFIX}GET_HEIGHT`,
  GET_WINDOW_INFO_AFTER_LOAD: `${RABBY_DECLARED_PREFIX}GET_WINDOW_INFO_AFTER_LOAD`,
  BROWSER_SCRIPT_ERR_CAPTURED: `${RABBY_DECLARED_PREFIX}BROWSER_SCRIPT_ERR_CAPTURED`,
};
/**
 * @tip for WeakSet, reference https://caniuse.com/?search=WeakSet
 * @tip safeJsonStringifyReplacer trim these:
 *  - circular references
 *  - __react, maybe from rsc hydration
 *  - BigInt, convert to string with 'n' suffix
 */
export const BROWSER_SCRIPT_BASE = /* js */`
;(function () {
  if (!${objRefs.poster}) {
    ${objRefs.poster} = function (content, pos) {
      if (typeof content !== 'object') content = { primitive: content };

      pos = pos || 'unknown';
      var jsonString = "";

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

      try {
        jsonString = JSON.stringify(content, safeJsonStringifyReplacer)
      } catch (e) {
        jsonString = JSON.stringify({
          type: '${RABBY_DECLARED_TYPES.BROWSER_SCRIPT_ERR_CAPTURED}',
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

  ${objRefs.getWinInfo} = function() {
    var siteNameMeta = document.querySelector('head > meta[property="og:site_name"]');
    var ogSiteName = siteNameMeta ? siteNameMeta.getAttribute('content') : '';
    var title = (function () {
      var titleMeta = document.querySelector('head > meta[name="title"]');
      return titleMeta ? titleMeta.getAttribute('content') : '';
    })() || document.title;

    var shortcutIconNode = window.document.querySelector('head > link[rel="shortcut icon"]');
    var shortcutIconHref = shortcutIconNode ? shortcutIconNode.href : '';
    var iconHref = shortcutIconHref || (function () {
      var iconNodes = Array.from(window.document.querySelectorAll('head > link[rel="icon"]')).find(function (icon) {
        return Boolean(icon.href);
      }) || [];
      return iconNodes && iconNodes.length > 0 ? iconNodes[0].href : '';
    })();

    var height = Math.max(document.documentElement.clientHeight, document.documentElement.scrollHeight, document.body.clientHeight, document.body.scrollHeight);

    return {
      title: title,
      ogSiteName: ogSiteName,
      height: height,
      shortcutIconHref: shortcutIconHref,
      iconHref: iconHref,
      referrer: document.referrer,
    }
  }
})();
`;

export const SPA_urlChangeListener = /* js */`;(function () {
  var __rabbyHistory = window.history;
  var __rabbyPushState = __rabbyHistory.pushState;
  var __rabbyReplaceState = __rabbyHistory.replaceState;
  function __rabby__updateUrl() {
    var info = ${objRefs.getWinInfo}();

    ${objRefs.poster}({
      type: '${RABBY_DECLARED_TYPES.NAV_CHANGE}',
      payload: {
        url: location.href,
        title: info.title,
        ogSiteName: info.ogSiteName,
        icon: info.iconHref,
        shortcutIconHref: info.shortcutIconHref,
        height: info.height,
      }
    }, 'NAV_CHANGE');

    setTimeout(() => {
      var height = Math.max(document.documentElement.clientHeight, document.documentElement.scrollHeight, document.body.clientHeight, document.body.scrollHeight);
      ${objRefs.poster}({
        type: '${RABBY_DECLARED_TYPES.GET_HEIGHT}',
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

  window.addEventListener('popstate', function(event) {
    __rabby__updateUrl();
  });
})();
`;

export const JS_GET_WINDOW_INFO_AFTER_LOAD = /* js */`
  ;(function () {
    setTimeout(function() {
      var info = ${objRefs.getWinInfo}();

      ${objRefs.poster}({
        type: '${RABBY_DECLARED_TYPES.GET_WINDOW_INFO_AFTER_LOAD}',
        payload: {
          url: location.href,
          title: info.title,
          ogSiteName: info.ogSiteName,
          icon: info.iconHref,
          shortcutIconHref: info.shortcutIconHref,
          height: info.height,
        }
      }, 'GET_WINDOW_INFO_AFTER_LOAD');
    }, 500);
  })();
`;

export const JS_DESELECT_TEXT = `if (window.getSelection) {window.getSelection().removeAllRanges();}
else if (document.selection) {document.selection.empty();}`;

export const JS_POST_MESSAGE_TO_PROVIDER = (
  message: string,
  origin: string,
) => /* js */`(function () {
  try {
    window.postMessage(${JSON.stringify(message)}, '${origin}');
  } catch (e) {
    // Nothing to do
    console.warn('[rabby-post-message-to-provider]', e);
  }
})()`;

export const JS_IFRAME_POST_MESSAGE_TO_PROVIDER = (
  message: string,
  origin: string,
) => `(function () {})()`;
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

export const JSBridgeHarden = /* js */`(function () {
    function safeStartsWith(str, search) {
        if (typeof str !== 'string' || typeof search !== 'string') {
            return false;
        }

        for (let i = 0; i < search.length; i++) {
          if (str[i] !== search[i]) {
            return false;
          }
        }

        return true;
    }

    if (window.ReactNativeWebView == null) {
        return;
    }
    const parse = JSON.parse;
    const realPost = window.ReactNativeWebView.postMessage.bind(window.ReactNativeWebView);
    function myPostMessage(msg) {
        try {
            const json = parse(msg);
            if (json &&
                json.name != null &&
                !(location.origin === json.origin ||
                    location.origin === json.origin + '/' || safeStartsWith(json.origin, location.origin + '/'))) {
                console.warn('Origin mismatch in postMessage: expected ' +
                    location.origin +
                    ', got ' +
                    json.origin);
                return;
            }
        }
        catch (_a) { }
        return realPost(msg);
    }
    window.ReactNativeWebView = new Proxy(window.ReactNativeWebView || {}, {
        get: function (target, prop) {
            if (prop === 'postMessage') {
                return myPostMessage;
            }
            const f = Reflect.get(target, prop);
            return typeof f === 'function' ? f.bind(target) : f;
        },
    });
})();`;
