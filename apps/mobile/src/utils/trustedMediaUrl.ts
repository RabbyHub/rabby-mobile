const isSvgUrl = (url: string) => /\.svg(?:$|[?#])/i.test(url);

export const isDebankMediaUrl = (url: string) => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'debank.com' || hostname.endsWith('.debank.com');
  } catch (_error) {
    return false;
  }
};

export const getTrustedSafeSvgUrl = (url?: string) => {
  if (!url || !isSvgUrl(url) || !isDebankMediaUrl(url)) {
    return undefined;
  }

  try {
    return new URL(url).protocol === 'https:' ? url : undefined;
  } catch (_error) {
    return undefined;
  }
};
