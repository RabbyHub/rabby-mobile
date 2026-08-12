import { CurveDayType } from '@/utils/curveDayType';
import {
  type CurveList,
  formChartData,
  makeDefaultSelectData,
} from '@/store/curveShared';

export type AddressCurveProjectionOptions = {
  realtimeNetWorth?: number | null;
  staticBalance?: number | null;
  baseUsdValue?: number | null;
  type?: CurveDayType;
};

type AddressCurveProjection = ReturnType<typeof formChartData>;

type NormalizedProjectionOptions = {
  realtimeNetWorth: number;
  staticBalance: number;
  baseUsdValue?: number | null;
  type: CurveDayType;
};

type ProjectionCacheEntry = {
  options: NormalizedProjectionOptions;
  projection: AddressCurveProjection;
};

const MAX_PROJECTIONS_PER_CURVE = 4;
const EMPTY_PROJECTION = makeDefaultSelectData();
const projectionCache = new WeakMap<CurveList, ProjectionCacheEntry[]>();

function normalizeOptions(
  options?: AddressCurveProjectionOptions,
): NormalizedProjectionOptions {
  return {
    realtimeNetWorth: options?.realtimeNetWorth ?? 0,
    staticBalance: options?.staticBalance ?? 0,
    baseUsdValue: options?.baseUsdValue,
    type: options?.type ?? CurveDayType.DAY,
  };
}

function areOptionsEqual(
  left: ProjectionCacheEntry['options'],
  right: ProjectionCacheEntry['options'],
) {
  return (
    left.realtimeNetWorth === right.realtimeNetWorth &&
    left.staticBalance === right.staticBalance &&
    left.baseUsdValue === right.baseUsdValue &&
    left.type === right.type
  );
}

export function getAddressCurveProjection(
  curveList: CurveList | undefined,
  options?: AddressCurveProjectionOptions,
) {
  if (!curveList?.length) {
    return EMPTY_PROJECTION;
  }

  const normalizedOptions = normalizeOptions(options);
  const cachedEntries = projectionCache.get(curveList) || [];
  const cached = cachedEntries.find(entry =>
    areOptionsEqual(entry.options, normalizedOptions),
  );
  if (cached) {
    return cached.projection;
  }

  const projection = formChartData(curveList, {
    ...normalizedOptions,
    realtimeTimestamp: Date.now(),
  });
  const nextEntries = [
    { options: normalizedOptions, projection },
    ...cachedEntries,
  ].slice(0, MAX_PROJECTIONS_PER_CURVE);
  projectionCache.set(curveList, nextEntries);

  return projection;
}
