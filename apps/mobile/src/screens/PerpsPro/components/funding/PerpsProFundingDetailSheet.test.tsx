import { render, screen, waitFor } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';

import { ThemeColors2024 } from '@/constant/theme';

const mockModalProps = jest.fn();
const mockGetFundingHistory = jest.fn().mockResolvedValue([]);
let mockBottomInset = 0;

jest.mock('@/components', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({ present: jest.fn() }));
        mockModalProps(props);
        return ReactModule.createElement(
          View,
          { testID: 'funding-detail-sheet' },
          props.children,
        );
      },
    ),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: ({
    linearGradientType,
  }: {
    linearGradientType: string;
  }) => ({
    testLinearGradientType: linearGradientType,
  }),
}));

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      info: { getFundingHistory: mockGetFundingHistory },
    }),
  },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: (selector: (state: object) => unknown) =>
    selector({
      currentClearinghouseState: { assetPositions: [] },
      isUserDataReady: true,
    }),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy(
      {},
      {
        get: (_target, key) =>
          key === 'neutral-line'
            ? 'rgba(224, 229, 236, 1)'
            : key === 'neutral-sheet-handle'
            ? 'rgba(209, 212, 219, 1)'
            : String(key),
      },
    );
    return {
      colors2024,
      isLight: true,
      styles: getStyle({ colors2024, isLight: true }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: mockBottomInset,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    BottomSheetView: (props: Record<string, unknown>) =>
      ReactModule.createElement(
        View,
        { style: props.style, testID: 'funding-detail-content' },
        props.children,
      ),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../common/perpsProSheetNavigationRegistry', () => ({
  usePerpsProSheetNavigationRegistration: jest.fn(),
}));

import {
  PERPS_PRO_FUNDING_ERROR_SHEET_HEIGHT,
  PERPS_PRO_FUNDING_SHEET_HEIGHT,
  PerpsProFundingDetailSheet,
} from './PerpsProFundingDetailSheet';

describe('PerpsProFundingDetailSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFundingHistory.mockReturnValue(new Promise(() => undefined));
    mockBottomInset = 0;
  });

  it('matches the approved Funding Rate sheet geometry and bottom spacing', () => {
    render(
      <PerpsProFundingDetailSheet
        market={
          {
            canonicalCoin: 'BTC',
            marketData: { funding: '0.0001', oraclePx: '60000' },
          } as never
        }
        onClose={jest.fn()}
        serverClock={null}
      />,
    );

    const modal = mockModalProps.mock.calls.at(-1)?.[0];
    expect(modal).toMatchObject({
      enableDynamicSizing: false,
      snapPoints: [PERPS_PRO_FUNDING_SHEET_HEIGHT],
      testLinearGradientType: 'bg1',
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('funding-detail-content').props.style,
      ),
    ).toMatchObject({ paddingBottom: 24 });
    expect(StyleSheet.flatten(modal.backgroundStyle)).toMatchObject({
      backgroundColor: 'neutral-bg-1',
    });
    expect(StyleSheet.flatten(modal.handleStyle)).toMatchObject({
      height: 40,
      paddingBottom: 27,
      paddingTop: 9,
    });
    expect(StyleSheet.flatten(modal.handleIndicatorStyle)).toMatchObject({
      backgroundColor: ThemeColors2024.light['neutral-sheet-handle'],
      height: 4,
      width: 40,
    });
    expect(
      StyleSheet.flatten(
        screen.getByText('page.perps.pro.funding.title').props.style,
      ),
    ).toMatchObject({
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
    });
    expect(
      StyleSheet.flatten(
        screen.getByText('page.perps.pro.funding.explanation').props.style,
      ),
    ).toMatchObject({
      color: 'neutral-foot',
      fontSize: 12,
      lineHeight: 16,
      marginTop: 19,
    });

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-funding-values').props.style,
      ),
    ).toMatchObject({
      borderBottomColor: 'neutral-bg-5',
      borderBottomWidth: 1,
      gap: 8,
      marginTop: 16,
      paddingBottom: 12,
    });
  });

  it('expands to the approved error geometry when history fails', async () => {
    mockGetFundingHistory.mockRejectedValueOnce(
      new Error('Funding history unavailable'),
    );

    render(
      <PerpsProFundingDetailSheet
        market={
          {
            canonicalCoin: 'BTC',
            marketData: { funding: '0.0001', oraclePx: '60000' },
          } as never
        }
        onClose={jest.fn()}
        serverClock={null}
      />,
    );

    await waitFor(() => {
      expect(mockModalProps.mock.calls.at(-1)?.[0].snapPoints).toEqual([
        PERPS_PRO_FUNDING_ERROR_SHEET_HEIGHT,
      ]);
    });
    expect(
      screen.getByText('page.perps.pro.funding.historyUnavailable'),
    ).toBeTruthy();
  });

  it('adds only the safe-area excess above the minimum bottom spacing', () => {
    mockBottomInset = 34;

    render(
      <PerpsProFundingDetailSheet
        market={
          {
            canonicalCoin: 'BTC',
            marketData: { funding: '0.0001', oraclePx: '60000' },
          } as never
        }
        onClose={jest.fn()}
        serverClock={null}
      />,
    );

    expect(mockModalProps.mock.calls.at(-1)?.[0].snapPoints).toEqual([
      PERPS_PRO_FUNDING_SHEET_HEIGHT + 10,
    ]);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('funding-detail-content').props.style,
      ),
    ).toMatchObject({ paddingBottom: 34 });
  });

  it('keeps the approved English funding rate label line breaks', () => {
    const localePath = path.resolve(
      __dirname,
      '../../../../assets/locales/en/messages.json',
    );
    const messages = JSON.parse(fs.readFileSync(localePath, 'utf8'));

    expect(messages.page.perps.pro.funding.previousRate).toBe(
      'Previous Funding\nRate / Annualized',
    );
    expect(messages.page.perps.pro.funding.nextRate).toBe(
      'Next Funding\nRate / Annualized',
    );
    expect(messages.page.perps.pro.funding.explanation).toBe(
      'The funding rate is used to calculate periodic payments between long and short position holders. When the funding rate is positive, longs pay shorts; when it is negative, shorts pay longs. The annualized rate is calculated using simple annualization.',
    );
  });
});
