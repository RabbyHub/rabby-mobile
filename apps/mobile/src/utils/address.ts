export const ellipsis = (text: string) => {
  return text.replace(/^(.{6})(.*)(.{4})$/, '$1...$3');
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
