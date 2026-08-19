const normalizeAddresses = (addresses: readonly string[]) =>
  Array.from(
    new Set(addresses.map(address => address.toLowerCase()).filter(Boolean)),
  );

export function prepareHomeManualAssetRefreshAddresses(
  addresses: readonly string[],
) {
  return normalizeAddresses(addresses);
}

export function shouldReconcileHomeManualAssetRefresh(
  earlyAddresses: readonly string[] | undefined,
  latestAddresses: readonly string[],
) {
  const latest = normalizeAddresses(latestAddresses);
  if (!latest.length) {
    return false;
  }
  if (!earlyAddresses?.length) {
    return true;
  }

  const early = new Set(normalizeAddresses(earlyAddresses));
  return (
    latest.length !== early.size || latest.some(address => !early.has(address))
  );
}
