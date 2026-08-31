/**
 * Hyperliquid reports both the unset legacy value (`default`) and the
 * explicitly disabled account-abstraction value (`disabled`) for Standard
 * accounts. DEX abstraction is a separate legacy mode and must not inherit
 * Standard Spot-to-Perps transfer eligibility.
 */
export const isPerpsStandardTransferAbstraction = (
  userAbstraction: unknown,
): boolean => userAbstraction === 'default' || userAbstraction === 'disabled';
