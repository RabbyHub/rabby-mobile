import { stringUtils } from "@rabby-wallet/base-utils/src";

// import queryString from 'query-string'
// const qsObj = queryString.parse(window.location.search);

export function formatRabbySchemeUrl(rabbyGoEnv: string, hrefString: string) {
  const appSchema = (() => {
    switch (rabbyGoEnv) {
      case 'mobile-debug':
        return 'rabbygo-debug:';
      case 'mobile-regression':
        return 'rabbygo-regression:';
      case 'mobile-production':
      case 'mobile':
        return 'rabbygo:';
    }
  })();

  const rabbySchemeUrl = hrefString.replace(/^https?:\/\//, `${appSchema}//`);
  return rabbySchemeUrl;
}

export function makeRabbySchemeUrl(rabbyGoEnv: string, targetLink: string) {
  if (!targetLink) return '';

  targetLink = stringUtils.ensurePrefix(targetLink, 'https://');
  const ret = { domain: '', pathPrefix: '' };

  switch (rabbyGoEnv) {
    default:
    case 'mobile-debug': {
      ret.domain = 'go-debug.rabby.io';
      ret.pathPrefix = 'mobile-debug';
      break;
    }
    case 'mobile-regression': {
      ret.domain = 'go-regression.rabby.io';
      ret.pathPrefix = 'mobile-regression';
      break;
    }
    case 'mobile-production': {
      ret.domain = 'go-production.rabby.io';
      ret.pathPrefix = 'mobile';
      break;
    }
  }

  // const openLink = `${ret.domain}/${ret.pathPrefix}/index.html?_cmd=open-dapp&dapp=${encodeURIComponent(targetLink)}`;
  const openLink = `${ret.domain}/${ret.pathPrefix}/?_cmd=open-dapp&dapp=${encodeURIComponent(targetLink)}`;
  return formatRabbySchemeUrl(rabbyGoEnv, stringUtils.ensurePrefix(openLink, 'https://'));
}

