export type PerpsConfirmedOrder = Readonly<{
  acceptance: 'filled' | 'resting';
  oid?: number;
  price: string;
  size: string;
}>;
