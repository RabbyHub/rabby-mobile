/* global inpageBundle */
/* or gloabl fn: injectRabbyPageProvider */

// const isAndroid = window.navigator.userAgent.includes('Android');

/**
 * @why on Android, `injectedJavaScriptBeforeContentLoaded` is not reliable.
 *
 * I manged to make it work by:
 * - preload WebView once on App bootstrapped, this MAYBE make this inpage "injected" like what chrome extension's content-script does
 * - <del>in DappWebViewControl, do not render WebView at first time, instead, trigger its first time render after first source.url/source.html confirmed.</del>
 * - make sure setup providers at FIRST tick, so we CAN'T wait for `DOMContentLoaded` event. Instead, we should retry it on DOMContentLoaded
 *
 *
 * @see https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md#injectedjavascriptbeforecontentloaded
 * @see
 * > Warning On Android, this may work, but it is not 100% reliable (see #1609 and #1099). Consider injectedJavaScriptObject instead.
 */

const RETRY_LIMIT = 20;
const injectionState = {
  // /**
  //  * @type {'idle' | 'pending' | 'complete' | 'error'}
  //  */
  // stage: 'idle',
  error: null,
  retry: 0
};
async function injectProcess() {
  do {
    try {
      /**
       * if it really shouln't inject, just quit the process.
       *
       * BUT, if it failed by accident, (such as `documentElementCheck()` failed due to `document.documentElement` invalid),
       * we should retry it.
       */
      if (!shouldInject()) return ;
      injectScript();

      injectionState.error = null;
    } catch (err) {
      injectionState.error = err;
      await wait(50);
      injectionState.retry++;
    }
  } while (injectionState.error && injectionState.retry < RETRY_LIMIT)

  if (injectionState.error) {
    console.error(`Rabby script injection failed, total retry count: ${injectionState.retry}`, injectionState.error);
  } else if (injectionState.retry) {
    console.warn(`Rabby script injection succeeded after ${injectionState.retry} retries`);
  }

  await connectOnDomReady();
}
injectProcess();

// Functions
async function wait(ms = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sets up the stream communication and submits site metadata
 *
 */
async function connectOnDomReady() {
  await domIsReady();
  window._rabbySetupProvider();
}

/**
 * Injects a script tag into the current document
 *
 * @param {string} content - Code to be executed in the current document
 */
function injectScript() {
  try {
    if (typeof injectRabbyPageProvider === 'function') {
      injectRabbyPageProvider();
    } else if (typeof inpageBundle === 'string') {
      const container = document.head || document.documentElement;

      // synchronously execute script in page context
      const scriptTag = document.createElement('script');
      scriptTag.setAttribute('async', false);
      scriptTag.textContent = inpageBundle;
      container.insertBefore(scriptTag, container.children[0]);

      // script executed; remove script element from DOM
      container.removeChild(scriptTag);
    }
  } catch (err) {
    console.error('Rabby script injection failed', err);
  }
}

/**
 * Determines if the provider should be injected.
 *
 * @returns {boolean} {@code true} if the provider should be injected.
 */
function shouldInject() {
  return (
    doctypeCheck() &&
    suffixCheck() &&
    documentElementCheck() &&
    !blockedDomainCheck()
  );
}

/**
 * Checks the doctype of the current document if it exists
 *
 * @returns {boolean} {@code true} if the doctype is html or if none exists
 */
function doctypeCheck() {
  const { doctype } = window.document;
  if (doctype) {
    return doctype.name === 'html';
  }
  return true;
}

/**
 * Returns whether or not the extension (suffix) of the current document is
 * prohibited.
 *
 * This checks {@code window.location.pathname} against a set of file extensions
 * that should not have the provider injected into them. This check is indifferent
 * of query parameters in the location.
 *
 * @returns {boolean} whether or not the extension of the current document is prohibited
 */
function suffixCheck() {
  const prohibitedTypes = [/\\.xml$/u, /\\.pdf$/u];
  const currentUrl = window.location.pathname;
  for (let i = 0; i < prohibitedTypes.length; i++) {
    if (prohibitedTypes[i].test(currentUrl)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks the documentElement of the current document
 *
 * @returns {boolean} {@code true} if the documentElement is an html node or if none exists
 *
 * @notice on Android, it's executing javascript BEFORE content loaded, so it's possible that we cannot get `document.head`, `document.documentElement`, etc.
 */
function documentElementCheck() {
  const documentElement = document.documentElement.nodeName;
  if (documentElement) {
    return documentElement.toLowerCase() === 'html';
  }
  return true;
}

/**
 * Checks if the current domain is blocked
 *
 * @returns {boolean} {@code true} if the current domain is blocked
 */
function blockedDomainCheck() {
  const blockedDomains = [
    'uscourts.gov',
    'dropbox.com',
    'webbyawards.com',
    'cdn.shopify.com/s/javascripts/tricorder/xtld-read-only-frame.html',
    'adyen.com',
    'gravityforms.com',
    'harbourair.com',
    'ani.gamer.com.tw',
    'blueskybooking.com',
    'sharefile.com',
  ];
  const currentUrl = window.location.href;
  // leave here for debug
  // window.alert('currentUrl is ' + currentUrl);
  // allow loaded as html
  if (currentUrl === 'about:blank') return false;

  let currentRegex;
  for (let i = 0; i < blockedDomains.length; i++) {
    const blockedDomain = blockedDomains[i].replace('.', '\\.');
    currentRegex = new RegExp(
      `(?:https?:\\/\\/)(?:(?!${blockedDomain}).)*$`,
      'u',
    );
    if (!currentRegex.test(currentUrl)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns a promise that resolves when the DOM is loaded (does not wait for images to load)
 */
async function domIsReady() {
  // already loaded
  if (['interactive', 'complete'].includes(document.readyState)) {
    return;
  }
  // wait for load
  await new Promise((resolve) =>
    window.addEventListener('DOMContentLoaded', resolve, { once: true }),
  );
}
