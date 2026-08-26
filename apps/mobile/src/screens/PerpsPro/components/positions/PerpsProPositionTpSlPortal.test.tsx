import { fireEvent, render, screen } from '@testing-library/react-native';
import { PortalProvider } from '@gorhom/portal';
import React from 'react';

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  return {
    runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
    useAnimatedReaction: jest.fn(),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
  };
});

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ fontScale: 1, height: 852, scale: 3, width: 393 }),
}));

jest.mock('@/components/AutoLockView', () => require('react-native').View);

jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { Portal } = require('@gorhom/portal');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (
        { children }: { children: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          dismiss: jest.fn(),
          present: jest.fn(),
        }));
        return ReactModule.createElement(
          Portal,
          { name: 'position-tpsl-portal-test' },
          children,
        );
      },
    ),
  };
});

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: require('react-native').View,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 47 }),
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, safeAreaInsets: { bottom: 0 } }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { percent?: string }) =>
      values?.percent
        ? `${values.percent} Position Size`
        : {
            'page.perps.pro.positionTpsl.addButton': 'Add TP/SL',
            'page.perps.pro.positionTpsl.estimatedPnlShort': 'Est. PnL',
            'page.perps.pro.positionTpsl.modify': 'Modify',
            'page.perps.pro.positionTpsl.positionSizeCoverage': 'Position Size',
            'page.perps.pro.positionTpsl.takeProfit': 'Take Profit',
            'page.perps.pro.positionTpsl.triggerPrice': 'Trigger Price',
            'page.perps.pro.positionTpsl.unfilledAmount': 'Unfilled Amt',
            'page.perps.pro.positions.market': 'Market',
            'page.perps.pro.positions.positionTpsl': 'Position TP/SL',
            'page.perps.pro.positions.price': 'Price',
            'page.perps.pro.positions.tpsl': 'TP/SL',
          }[key] || key,
  }),
}));

jest.mock('../../scene/usePerpsProPositionMark', () => ({
  usePerpsProPositionMark: () => ({ markPrice: '100' }),
}));

jest.mock('../common/PerpsProDottedUnderlineText', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    PerpsProDottedUnderlineText: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel: string;
      children: React.ReactNode;
      onPress: () => void;
    }) =>
      ReactModule.createElement(
        Pressable,
        { accessibilityLabel, accessibilityRole: 'button', onPress },
        ReactModule.createElement(Text, null, children),
      ),
  };
});

jest.mock('../common/PerpsProFieldExplanationSheet', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');
  return {
    PerpsProFieldExplanationSheet: ({
      explanationKey,
    }: {
      explanationKey: string;
    }) =>
      ReactModule.createElement(
        Text,
        { testID: 'field-explanation-sheet' },
        explanationKey,
      ),
  };
});

jest.mock('../common/usePerpsProDismissKeyboard', () => ({
  usePerpsProDismissKeyboard: () => (action: () => void) => action(),
}));

jest.mock('../common/perpsProSheetNavigationRegistry', () => ({
  usePerpsProSheetNavigationRegistration: jest.fn(),
}));

jest.mock('./PerpsProPositionTpSlHeader', () => ({
  PerpsProPositionTpSlHeader: () => null,
  PerpsProPositionTpSlPageHeader: () => null,
}));

jest.mock('./PerpsProPositionTpSlForm', () => ({
  PerpsProPositionTpSlForm: () => null,
}));

import type { PerpsPositionViewModel } from '../../model/position';
import type { PerpsPositionTpSlOrderViewModel } from '../../model/positionTpSl';
import { PerpsProFieldExplanationProvider } from '../common/PerpsProFieldExplanationProvider';
import { PerpsProPositionTpSlSheet } from './PerpsProPositionTpSlSheet';

const partialOrder: PerpsPositionTpSlOrderViewModel = {
  execution: 'market',
  key: 'partial:BTC:1',
  kind: 'takeProfit',
  oid: 1,
  originalSize: '0.5',
  remainingSize: '0.5',
  scope: 'partial',
  side: 'A',
  timestamp: 1,
  triggerPrice: '110',
};

const position: PerpsPositionViewModel = {
  baseSize: '1',
  coin: 'BTC',
  direction: 'long',
  entryPrice: '100',
  key: 'BTC',
  leverage: 10,
  liquidationPrice: '80',
  margin: '10',
  marginMode: 'cross',
  marginRatio: null,
  maxLeverage: 50,
  pnl: '0',
  quoteSize: '100',
  roiRatio: '0',
  tpslOrders: [partialOrder],
};

const market = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  markPrice: '100',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  sourceTag: null,
  szDecimals: 3,
};

describe('PerpsProPositionTpSlSheet portal integration', () => {
  it('opens Estimated PnL through the provider captured outside the sheet portal', () => {
    render(
      <PortalProvider>
        <PerpsProFieldExplanationProvider>
          <PerpsProPositionTpSlSheet
            amountUnit="base"
            cancelingOids={[]}
            confirmedCancelledOids={[]}
            coveredByReview={false}
            defaultTab="partial"
            market={market}
            onCancelOrder={jest.fn()}
            onClose={jest.fn()}
            onReview={jest.fn()}
            pending={false}
            position={position}
            visible
          />
        </PerpsProFieldExplanationProvider>
      </PortalProvider>,
    );

    fireEvent.press(screen.getByLabelText('Est. PnL (USDC)'));

    expect(screen.getByTestId('field-explanation-sheet')).toHaveTextContent(
      'estimatedPnl',
    );
  });
});
