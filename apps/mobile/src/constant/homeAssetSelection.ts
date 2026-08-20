export const HOME_ASSET_TOP_N_OPTIONS = [10, 20, 30, 50, 100] as const;

export type HomeAssetTopN = (typeof HOME_ASSET_TOP_N_OPTIONS)[number];

export const DEFAULT_HOME_ASSET_TOP_N: HomeAssetTopN = 10;

export function coerceHomeAssetTopN(value: unknown): HomeAssetTopN {
  const numericValue = typeof value === 'number' ? value : Number(value);
  const option = HOME_ASSET_TOP_N_OPTIONS.find(
    candidate => candidate === numericValue,
  );

  return option || DEFAULT_HOME_ASSET_TOP_N;
}
