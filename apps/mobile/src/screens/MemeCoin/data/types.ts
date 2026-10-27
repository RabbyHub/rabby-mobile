export type MemeToken = {
  id: string;
  chain: string;
  symbol: string;
  logoUrl: string;
  price: number;
  /** ratio: 0.0824 = +8.24%; null when there is no price 24h ago */
  change24h: number | null;
};

export type MemeMarketItem = MemeToken & {
  /** fdv_usd (price × total supply), same basis as the backend */
  marketCap: number;
};

export type MemeHolding = {
  meme: MemeToken;
  amount: number;
  valueUsd: number;
};
