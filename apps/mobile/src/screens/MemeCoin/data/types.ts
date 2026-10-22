export type MemeMarketItem = {
  id: string;
  chain: string;
  symbol: string;
  logoUrl: string;
  price: number;
  /** fdv (price × total supply), same basis as the backend plan */
  marketCap: number;
  /** ratio: 0.0824 = +8.24% */
  change24h: number;
};

export type MemeHolding = {
  meme: MemeMarketItem;
  amount: number;
  valueUsd: number;
};
