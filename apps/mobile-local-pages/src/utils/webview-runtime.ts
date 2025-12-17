/// <reference path="../types/duplex.d.ts" />

import { atom } from 'jotai';
import { pageStore } from './page-store';

const injectedObjectRef = {
  current: null as RuntimeInfo | null,
};

type StringOrObject<T extends object> = T | string;

export function postMessageToRN(message: StringOrObject<DuplexPost>) {
  if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
    console.warn('ReactNativeWebView is not ready');
    return;
  }

  window.ReactNativeWebView.postMessage(
    typeof message === 'string' ? message : JSON.stringify(message),
  );
}

const waitDomContentLoadedPromise = new Promise<void>(resolve => {
  document.addEventListener('DOMContentLoaded', () => {
    resolve();
    if (!injectedObjectRef.current) {
      if (
        window.ReactNativeWebView &&
        window.ReactNativeWebView.injectedObjectJson
      ) {
        const injectedData = JSON.parse(
          window.ReactNativeWebView.injectedObjectJson(),
        ) as RuntimeInfo;
        injectedObjectRef.current = injectedData;
        setRuntimeInfo(injectedData);
      }
    }

    postMessageToRN({ type: 'GET_RUNTIME_INFO' });
  });
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

window.addEventListener('messageFromRN', function (event) {
  const message = (event as any as CustomEvent).detail as DuplexReceive;

  switch (message.type) {
    case 'GOT_RUNTIME_INFO': {
      injectedObjectRef.current = message.info;
      setRuntimeInfo(message.info);
      break;
    }
    case 'GASKETVIEW:TOGGLE_LOADING':
    case 'GOT_WINDOW_INFO': {
      break;
    }
    default: {
      console.warn('Unknown message from RN', message);
    }
  }
});

function setDocumentRuntimeInfo(
  runtimeInfo: Partial<Pick<RuntimeInfo, 'isDark' | 'language'>>,
) {
  try {
    document.documentElement.setAttribute(
      'data-theme',
      runtimeInfo.isDark ? 'dark' : 'light',
    );
    document.documentElement.setAttribute(
      'lang',
      runtimeInfo.language || 'en-US',
    );

    document.documentElement.setAttribute('data-os', getPlatform());
  } catch (error) {
    console.error('setDocumentRuntimeInfo error', error);
  }
}

export const runtimeInfoAtom = atom<RuntimeInfo>({
  runtimeBaseUrl: '',
  platform: 'ios',
  useDevResource: false,
  isDark: false,
});

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function setRuntimeInfo(runtimeInfo: Partial<RuntimeInfo>) {
  pageStore.set(runtimeInfoAtom, prev => {
    const newInfo: RuntimeInfo = {
      ...prev,
      runtimeBaseUrl: runtimeInfo.runtimeBaseUrl ?? prev.runtimeBaseUrl,
      platform:
        runtimeInfo.platform ?? prev.platform ?? (isIOS() ? 'ios' : 'android'),
      useDevResource: runtimeInfo.useDevResource ?? prev.useDevResource,
      isDark: runtimeInfo.isDark ?? prev.isDark,
      language: (runtimeInfo.language ?? prev.language) || 'en-US',
      i18nTexts: (runtimeInfo.i18nTexts ?? prev.i18nTexts) || {},
    };

    setDocumentRuntimeInfo(newInfo);

    return newInfo;
  });
}
