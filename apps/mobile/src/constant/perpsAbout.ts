/**
 * Manual about content configuration per coin.
 * Key = coin name as it appears in MarketData.name (e.g., 'BTC', 'ETH', 'xyz:TSLA').
 * Content is English text — i18n can be layered on top later if needed.
 */
export const PERPS_ABOUT_CONTENT: Record<string, string> = {
  BTC: 'Bitcoin (BTC) is the first decentralized cryptocurrency, created in 2009 by an anonymous person or group known as Satoshi Nakamoto. It operates on a peer-to-peer network using blockchain technology.',
  ETH: 'Ethereum (ETH) is a decentralized, open-source blockchain with smart contract functionality. Ether is the native cryptocurrency of the platform.',
  SOL: 'Solana (SOL) is a high-performance blockchain supporting builders around the world creating crypto apps that scale.',
};

/**
 * Get the about content for a given coin name.
 * Returns null if no content is configured.
 */
export const getPerpsAboutContent = (coinName: string): string | null => {
  return PERPS_ABOUT_CONTENT[coinName] ?? null;
};
