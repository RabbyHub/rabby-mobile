import { isOrHasWithAllowedProtocol } from '@/constant/dappView';
import { isPossibleDomain } from '@/utils/url';
import { stringUtils, urlUtils } from '@rabby-wallet/base-utils';
import { useMemo } from 'react';

export const useParsePossibleURL = (_str: string) => {
  return useMemo(() => {
    const str = _str.trim().toLowerCase();
    if (!str) {
      return null;
    }
    const parsedResult = urlUtils.safeParseURL(str);
    if (
      parsedResult?.protocol &&
      !isOrHasWithAllowedProtocol(parsedResult?.protocol)
    ) {
      return null;
    }

    if (isPossibleDomain(str)) {
      return stringUtils.ensurePrefix(str, 'https://');
    }
  }, [_str]);
};
