import * as stringUtils from '@rabby-wallet/base-utils/src/isomorphic/string';
import { getInjectedObject } from './webview-runtime';

export function resolvePublicResourcePath(path: string) {
  const isIOS =
    window.navigator.userAgent.includes('iPhone') ||
    window.navigator.userAgent.includes('iPad') ||
    window.navigator.userAgent.includes('iPod');

  if (isIOS) {
    const object = getInjectedObject();
    return [
      `${stringUtils.unSuffix(object.runtimeBaseUrl, '/')}`,
      object.useDevResource ? '' : 'builtin-pages',
      `${stringUtils.unPrefix(path, '/')}`,
    ]
      .filter(Boolean)
      .join('/');
  }

  return (
    stringUtils.unSuffix(import.meta.env.BASE_URL, '/') +
    stringUtils.ensurePrefix(path, '/')
  );
}

// export function usePublicResourcePath(path: string) {
// }
