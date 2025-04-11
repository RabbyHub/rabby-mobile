export const isSameAddress = (a: string, b: string) => {
  if (!a || !b) {
    return false;
  }
  return a.toLowerCase() === b.toLowerCase();
};

export const getAddressScanLink = (scanLink: string, address: string) => {
  if (/transaction\/_s_/.test(scanLink)) {
    return scanLink.replace(/transaction\/_s_/, `address/${address}`);
  } else if (/tx\/_s_/.test(scanLink)) {
    return scanLink.replace(/tx\/_s_/, `address/${address}`);
  } else {
    return scanLink.endsWith('/')
      ? `${scanLink}address/${address}`
      : `${scanLink}/address/${address}`;
  }
};

export const getTxScanLink = (scankLink: string, hash: string) => {
  if (scankLink.includes('_s_')) {
    return scankLink.replace('_s_', hash);
  }
  return scankLink.endsWith('/')
    ? `${scankLink}tx/${hash}`
    : `${scankLink}/tx/${hash}`;
};

export const ellipsis = (text: string, length = 6) => {
  const reg = new RegExp(`^(.{${length + 2}})(.*)(.{${length}})$`);
  return text.toString().replace(reg, '$1...$3');
};
