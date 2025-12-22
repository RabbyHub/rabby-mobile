export const ellipsis = (text: string, length = 6) => {
  if (!text) return '';
  const reg = new RegExp(`^(.{${length + 2}})(.*)(.{${length}})$`);
  return text.toString().replace(reg, '$1...$3');
};

export const shortEllipsisAddress = (text: string, length = 6) => {
  const reg = new RegExp(`^(.{${length}})(.*)(.{${length}})$`);
  return text.toString().replace(reg, '$1...$3');
};

export const ellipsisAddress = ellipsis;

export function formatAddressToShow(
  address?: string,
  options?: {
    ellipsis?: boolean;
    length?: number;
  },
) {
  const { ellipsis: isEllipsis = true, length = 6 } = options || {};
  return isEllipsis
    ? `${ellipsisAddress(address || '')
        .toLowerCase()
        .slice(0, length + 2)}...${address?.toLowerCase().slice(-length)}`
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

export type Hex = `0x${string}`;

export function add0x(hexadecimal: string): Hex {
  if (hexadecimal.startsWith('0x')) {
    return hexadecimal as Hex;
  }

  if (hexadecimal.startsWith('0X')) {
    return `0x${hexadecimal.substring(2)}`;
  }

  return `0x${hexadecimal}`;
}

export function isStrictHexString(value: unknown): value is Hex {
  if (typeof value === 'string') {
    return /^0x[0-9a-f]+$/iu.test(value);
  }
  return false;
}
