type AccountIdentity = {
  address: string;
  brandName: string;
  type: string;
};

export function isSameAccount(
  account?: AccountIdentity | null,
  target?: AccountIdentity | null,
) {
  if (!account || !target) {
    return false;
  }

  return (
    target.address.toLowerCase() === account.address.toLowerCase() &&
    target.brandName === account.brandName &&
    target.type === account.type
  );
}
