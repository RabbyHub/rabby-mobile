export const ellipsis = (text: string) => {
  return text.toString().replace(/^(.{6})(.*)(.{4})$/, '$1...$3');
};

export const ellipsisAddress = ellipsis;

export function formatAddressToShow(
  address?: string,
  options?: {
    ellipsis?: boolean;
  },
) {
  const { ellipsis: isEllipsis = true } = options || {};

  return isEllipsis
    ? `${ellipsisAddress(address || '')
        .toLowerCase()
        .slice(0, 6)}...${address?.toLowerCase().slice(-4)}`
    : address?.toLowerCase();
}

export const enum AddressType {
  EOA = 'EOA',
  CONTRACT = 'CONTRACT',
  UNKNOWN = 'UNKNOWN',
}

export const getAddressScanLink = (scanLink: string, address: string) => {
  if (/transaction\/_s_/.test(scanLink)) {
    return scanLink.replace(/transaction\/_s_/, `address/${address}`);
  }
  return scanLink.replace(/tx\/_s_/, `address/${address}`);
};
