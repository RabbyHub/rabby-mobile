import { stringUtils } from '@rabby-wallet/base-utils';

export const isPossibleDomain = (str: string) => {
  var domainRegex = /^(?:\S(?:\S{0,61}\S)?\.)+\S{2,}$/;

  return domainRegex.test(str);
};

export function formatDappOriginToShow(dappOrigin: string) {
  return stringUtils.unPrefix(dappOrigin, 'https://');
}

const httpProtocolPattern = /^((http|https|ftp):\/\/)/;
export function withHttp(url: string, defaultProtocol = 'https') {
  if (!httpProtocolPattern.test(url)) {
    url = `${defaultProtocol}://${url}`;
  }
  return url;
}

export const isValidateUrl = (url: string) => {
  return /^(https?|http?):\/\/(localhost|\S)+/.test(url);
};
