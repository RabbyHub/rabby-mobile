/// <reference path="../types/duplex.d.ts" />

const injectedObjectRef = {
  current: null as RuntimeInfo | null,
}

type StringOrObject<T extends object> = T | string;

function postMessageToRN (message: StringOrObject<DuplexPost>) {
  if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
    console.warn('ReactNativeWebView is not ready');
    return;
  }

  window.ReactNativeWebView.postMessage(
    typeof message === 'string' ? message : JSON.stringify(message)
  );
}

const waitDomContentLoadedPromise = new Promise<void>((resolve) => {
  document.addEventListener('DOMContentLoaded', () => {
    resolve();
    if (!injectedObjectRef.current) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.injectedObjectJson) {
        const injectedData = JSON.parse(window.ReactNativeWebView.injectedObjectJson()) as RuntimeInfo;
        injectedObjectRef.current = injectedData;
      }
    }

    postMessageToRN({ type: 'GET_RUNTIME_INFO' });
  })
});

export async function onDomReady() {
  return waitDomContentLoadedPromise;
}

export function getInjectedObject() {
  if (!injectedObjectRef.current) {
    throw new Error('injectedObject is not ready');
  }
  return injectedObjectRef.current;
}

export function getPlatform(): 'ios' | 'android' {
  return getInjectedObject().platform;
}

window.onMessageFromReactNative = function(message) {
  console.debug('[debug] onMessageFromReactNative', message.info);

  switch (message.type) {
    case 'GOT_RUNTIME_INFO': {
      injectedObjectRef.current = message.info;
      break;
    }
    default: {
      console.warn('Unknown message from ReactNative', message);
    }
  }
}
