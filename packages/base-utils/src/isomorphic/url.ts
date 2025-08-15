import { unPrefix } from './string';

type IParseDomainInfo = {
  subDomain: string;
  hostWithoutTLD: string;
  tld: string;
  secondaryDomain: string;
  secondaryOrigin: string;
  is2ndaryDomain: boolean;
  isWWWSubDomain: boolean;
  isSubDomain: boolean;
};

type ICanonalizedUrlInfo = {
  urlInfo: Partial<URL> | null;
  isDapp: boolean;
  origin: string;
  httpOrigin: string;
  hostname: string;
  fullDomain: string;
} & IParseDomainInfo;

type I2ndDomainMeta = {
  is2ndaryDomain: boolean;
  secondaryDomain: string;
  secondaryDomainOriginExisted: boolean;
  origin: string;
  subDomains: string[];
};

export function safeParseURL(url: string): URL | null {
  try {
    return new URL(url);
  } catch (e) {
    return null;
  }
}

export function safeGetOrigin<T extends string>(url: T): T {
  return (safeParseURL(url)?.origin || url) as T;
}

export function parseQueryString(
  input: string = typeof window !== 'undefined'
    ? window.location.search.slice(1)
    : '',
) {
  const result: Record<string, string> = {};
  const queryStr = (input || '').replace(/^[?#&]/, '');

  queryStr
    .trim()
    .split('&')
    .forEach(part => {
      const [key, value] = part.split('=') || [];
      if (!key) return;

      result[key] = decodeURIComponent(value);
    });
  return result;
}

/**
 * @description try to parse url, separate url and query
 */
function parseUrl(_url: string) {
  const [url, searchStr = ''] = _url.split('?');
  const [queryString, hashFragment = ''] = searchStr.split('#');

  const query: Record<string, any> = parseQueryString(queryString);

  let pathname = '';
  try {
    pathname = new URL(url).pathname;
    // eslint-disable-next-line no-empty
  } catch (e) {}
  const canoicalPath = pathname.replace(/\/$/, '');

  return { url, canoicalPath, query, queryString, hashFragment };
}

export function integrateQueryToUrl(
  url: string,
  extQuery: Record<string, string | number | boolean>,
) {
  const { url: urlWithoutQuery, query: query1, hashFragment } = parseUrl(url);
  const query = { ...query1, ...extQuery };

  const queryStr2 = new URLSearchParams(query);
  return [
    `${urlWithoutQuery}?${queryStr2}`,
    hashFragment ? `#${hashFragment}` : '',
  ].join('');
}

export const query2obj = (str: string) => {
  const res: Record<string, string> = {};
  str.replace(/([^=?#&]*)=([^?#&]*)/g, (_, $1: string, $2: string) => {
    res[decodeURIComponent($1)] = decodeURIComponent($2);
    return '';
  });
  return res;
};

export const obj2query = (obj: Record<string, string>) => {
  return Object.keys(obj)
    .map(key => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`;
    })
    .join('&');
};

export function isUrlFromDapp(url: string) {
  if (url.startsWith('https:')) return true;

  return false;
}

export function isDappProtocol(protocolOrUrl: string) {
  return protocolOrUrl.startsWith('https:');
}

export function getDomainFromHostname(hostname: string): IParseDomainInfo {
  const parts = hostname.split('.');
  const secondaryDomainParts = parts.slice(parts.length - 2);
  const secondaryDomain = secondaryDomainParts.join('.');

  return {
    subDomain: parts.slice(0, parts.length - 2).join('.'),
    hostWithoutTLD: secondaryDomainParts[0],
    tld: secondaryDomainParts[1],
    secondaryDomain,
    secondaryOrigin: `https://${secondaryDomain}`,
    is2ndaryDomain: parts.length === 2 && secondaryDomain === hostname,
    isWWWSubDomain: parts.length === 3 && parts[0] === 'www',
    isSubDomain: parts.length > 2,
  };
}

export function splitPathname(pathnameWithQuery: string) {
  pathnameWithQuery = unPrefix(pathnameWithQuery, '/');

  const [pathname, pathnameSearch] = pathnameWithQuery.split('?') || [];
  const pathnameWithoutHash = pathname.split('#')?.[0] || '';

  return {
    pathnameWithQuery,
    pathname,
    pathnameSearch,
    pathnameWithoutHash,
  };
}

type IDappInfoFromURL = {
  type: 'http';
  pathnameWithQuery: string;
};
export function extractDappInfoFromURL(dappURL: string): IDappInfoFromURL {
  // ----------------------- http(s) --------------------------------
  return {
    type: 'http',
    pathnameWithQuery: safeParseURL(dappURL)?.pathname || '',
  };
}

export function makeDappAboutURLs(input: { type: 'http'; httpsURL: string }) {
  const result = {
    dappID: '',
    dappOrigin: '',
    httpOrigin: '',
  };

  result.dappID = input.httpsURL;
  result.dappOrigin = input.httpsURL;
  result.httpOrigin = input.httpsURL;

  return result;
}

export function canoicalizeDappUrl(url: string): ICanonalizedUrlInfo {
  const urlInfo: Partial<URL> | null = safeParseURL(url);

  const hostname = urlInfo?.hostname || '';
  const isDapp = !!urlInfo?.protocol && ['https:'].includes(urlInfo?.protocol);

  let origins = {
    dappOrigin: '',
    httpOrigin: '',
  };

  origins.dappOrigin =
    urlInfo?.origin ||
    `${urlInfo?.protocol}//${hostname}${
      urlInfo?.port ? `:${urlInfo?.port}` : ''
    }`;
  origins.httpOrigin = origins.dappOrigin;

  const domainInfo = getDomainFromHostname(hostname);

  return {
    urlInfo,
    isDapp,
    origin: origins.dappOrigin,
    httpOrigin: origins.httpOrigin,
    hostname,
    fullDomain: urlInfo?.host || '',
    ...domainInfo,
  };
}

export function parseDomainMeta(
  urlOrigin: string,
  inputOrigins: (string | { origin: string })[] | Set<string>,
  retCache: Record<I2ndDomainMeta['secondaryDomain'], I2ndDomainMeta>,
) {
  const allOrigins = Array.from(inputOrigins);

  const parsed = canoicalizeDappUrl(urlOrigin);

  if (!retCache[parsed.secondaryDomain]) {
    const record: I2ndDomainMeta = {
      secondaryDomain: parsed.secondaryDomain,
      origin: parsed.origin,
      is2ndaryDomain: parsed.is2ndaryDomain,
      secondaryDomainOriginExisted: false,
      subDomains: [],
    };

    allOrigins.forEach(dO => {
      const dappOrigin = typeof dO === 'string' ? dO : dO.origin;
      const originInfo = canoicalizeDappUrl(dappOrigin);
      if (originInfo.secondaryDomain !== record.secondaryDomain) return;

      if (originInfo.is2ndaryDomain) {
        record.secondaryDomainOriginExisted = true;
      } else if (!record.subDomains.includes(originInfo.hostname)) {
        record.subDomains.push(originInfo.hostname);
      }
    });

    retCache[parsed.secondaryDomain] = record;
  }

  return retCache[parsed.secondaryDomain];
}

export const sanitizeUrlInput = (url: string) =>
  url.replace(/'/g, '%27').replace(/[\r\n]/g, '');
