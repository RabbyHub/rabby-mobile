import { stringUtils } from '@rabby-wallet/base-utils';

export const isPossibleDomain = (str: string) => {
  var domainRegex = /^(?:\S(?:\S{0,61}\S)?\.)+\S{2,}$/;

  return domainRegex.test(str);
};

export function formatDappOriginToShow(dappOrigin: string) {
  return stringUtils.unPrefix(dappOrigin, 'https://');
}
