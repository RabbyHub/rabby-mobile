import { CurveDayType } from '@/utils/curveDayType';
import { formChartData, type CurveList } from '@/store/curveShared';
import { getAddressCurveProjection } from './addressCurveProjection';

jest.mock('@/store/curveShared', () => ({
  formChartData: jest.fn(
    (
      data: CurveList,
      options: {
        realtimeNetWorth: number;
        staticBalance: number;
      },
    ) => ({
      list: [
        ...data.map(item => ({
          value: item.usd_value,
          timestamp: item.timestamp,
        })),
        {
          value: options.realtimeNetWorth,
          timestamp: 0,
        },
      ],
      rawNetWorth: options.staticBalance,
      rawChange: 0,
      netWorth: '',
      change: '',
      changePercent: '0%',
      isLoss: false,
      isEmptyAssets: false,
    }),
  ),
  makeDefaultSelectData: jest.fn(() => ({
    list: [],
    rawNetWorth: 0,
    rawChange: 0,
    netWorth: '',
    change: '',
    changePercent: '',
    isLoss: false,
    isEmptyAssets: false,
  })),
}));

function makeCurveList(): CurveList {
  return [
    { timestamp: 1_000, usd_value: 100 },
    { timestamp: 2_800, usd_value: 110 },
  ];
}

describe('getAddressCurveProjection', () => {
  beforeEach(() => {
    jest.mocked(formChartData).mockClear();
  });

  it('shares a projection for identical source data and values', () => {
    const curveList = makeCurveList();
    const first = getAddressCurveProjection(curveList, {
      realtimeNetWorth: 120,
      staticBalance: 125,
      baseUsdValue: 100,
    });
    const second = getAddressCurveProjection(curveList, {
      realtimeNetWorth: 120,
      staticBalance: 125,
      baseUsdValue: 100,
    });

    expect(second).toBe(first);
    expect(formChartData).toHaveBeenCalledTimes(1);
  });

  it('recomputes when a value that affects the projection changes', () => {
    const curveList = makeCurveList();
    const first = getAddressCurveProjection(curveList, {
      realtimeNetWorth: 120,
      staticBalance: 125,
      baseUsdValue: 100,
    });
    const second = getAddressCurveProjection(curveList, {
      realtimeNetWorth: 130,
      staticBalance: 125,
      baseUsdValue: 100,
    });

    expect(second).not.toBe(first);
    expect(second.list.at(-1)?.value).toBe(130);
    expect(formChartData).toHaveBeenCalledTimes(2);
  });

  it('keeps independent projections for different curve periods', () => {
    const curveList = makeCurveList();
    const day = getAddressCurveProjection(curveList, {
      realtimeNetWorth: 120,
      staticBalance: 125,
      baseUsdValue: 100,
      type: CurveDayType.DAY,
    });
    const week = getAddressCurveProjection(curveList, {
      realtimeNetWorth: 120,
      staticBalance: 125,
      baseUsdValue: 100,
      type: CurveDayType.WEEK,
    });

    expect(week).not.toBe(day);
    expect(
      getAddressCurveProjection(curveList, {
        realtimeNetWorth: 120,
        staticBalance: 125,
        baseUsdValue: 100,
        type: CurveDayType.DAY,
      }),
    ).toBe(day);
    expect(formChartData).toHaveBeenCalledTimes(2);
  });

  it('shares the immutable empty projection', () => {
    expect(getAddressCurveProjection(undefined)).toBe(
      getAddressCurveProjection([]),
    );
  });
});
