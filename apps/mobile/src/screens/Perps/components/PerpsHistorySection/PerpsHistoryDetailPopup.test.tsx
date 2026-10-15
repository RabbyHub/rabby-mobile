import type { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

const mockShowFeeExplanation = jest.fn();

jest.mock('@/assets2024/icons/perps/IconInfoCC.svg', () => () => null);
jest.mock('@/components', () => ({ AssetAvatar: () => null }));
jest.mock('@/components/AutoLockView', () => require('react-native').View);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components2024/Button', () => ({ Button: () => null }));
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: object, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: jest.fn(),
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, props);
      },
    ),
  };
});
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
}));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/screens/Home/utils/price', () => ({ formatPercent: String }));
jest.mock('@/utils/number', () => ({
  formatPerpsNumber: String,
  splitNumberByStep: String,
}));
jest.mock('@/utils/perps', () => ({ formatPerpsCoin: String }));
jest.mock('../PerpsSpotSwapPopup', () => ({
  SPOT_STABLE_COIN_NAME: { USDT: '@166' },
}));
jest.mock('@/hooks/useTipsPopup', () => ({
  useTipsPopup: () => ({ showTipsPopup: jest.fn() }),
}));
jest.mock('@/screens/PerpsShared/components/PerpsTradeFeeExplanation', () => ({
  useShowPerpsTradeFeeExplanation: () => mockShowFeeExplanation,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      styles: getStyle({ colors2024, safeAreaInsets: { bottom: 0 } }),
      colors2024,
      isLight: true,
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PerpsHistoryDetailPopup } from './PerpsHistoryDetailPopup';

const fill: WsFill & { logoUrl: string; quoteAsset: string } = {
  coin: 'BTC',
  px: '10000',
  sz: '1',
  fee: '6.5',
  builderFee: '2',
  feeToken: 'USDC',
  closedPnl: '0',
  crossed: true,
  dir: 'Open Long',
  hash: '0xfill',
  oid: 1,
  side: 'B',
  startPosition: '0',
  tid: 1,
  time: 100,
  logoUrl: '',
  quoteAsset: 'USDC',
};

describe('Simple history fee entry', () => {
  beforeEach(() => mockShowFeeExplanation.mockClear());

  it('passes the current raw fill on every open, including an explicit zero builder fee', () => {
    const view = render(<PerpsHistoryDetailPopup fill={fill} />);
    fireEvent.press(screen.getByText('page.perps.historyDetail.fee'));
    expect(mockShowFeeExplanation).toHaveBeenLastCalledWith(false, fill);
    const nextFill = { ...fill, fee: '0', builderFee: '0', tid: 2 };
    view.rerender(<PerpsHistoryDetailPopup fill={nextFill} />);
    fireEvent.press(screen.getByText('page.perps.historyDetail.fee'));
    expect(mockShowFeeExplanation).toHaveBeenLastCalledWith(false, nextFill);
    expect(mockShowFeeExplanation).toHaveBeenCalledTimes(2);
  });

  it('keeps the liquidation flag together with its own fee facts', () => {
    const liquidationFill = {
      ...fill,
      liquidation: {
        liquidatedUser: '0xuser',
        markPx: '10000',
        method: 'market',
      },
    };
    render(<PerpsHistoryDetailPopup fill={liquidationFill} />);
    fireEvent.press(screen.getByText('page.perps.historyDetail.fee'));
    expect(mockShowFeeExplanation).toHaveBeenCalledWith(true, liquidationFill);
  });
});
