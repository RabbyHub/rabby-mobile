jest.mock(
  '@/assets2024/icons/perps/IconInfoCC.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/perps/PerpsProAvailableAdd.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleAccount/cross-info.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleChart/up.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleChart/down.svg',
  () => require('react-native').View,
);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));
jest.mock('@/utils/number', () => ({
  splitNumberByStep: (value: unknown) => String(value),
  formatUsdValue: (value: number) => `$${value.toFixed(2)}`,
}));
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { PerpsPosition } from './PerpsPosition';
import { simpleLiquidationPriceText } from './account/model';

const mockTips = jest.fn();
jest.mock('@/hooks/useTipsPopup', () => ({
  useTipsPopup: () => ({ showTipsPopup: mockTips }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    const colors2024 = new Proxy({}, { get: (_, key) => String(key) });
    return {
      colors2024,
      isLight: true,
      styles: getStyle({ colors2024, isLight: true }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: (selector: any) => selector({ currentPerpsAccount: null }),
}));
jest.mock('@/utils/stats', () => ({ stats: { report: jest.fn() } }));
jest.mock('@/constant', () => ({ APP_VERSIONS: {} }));
jest.mock('@/utils/perps', () => ({
  formatPerpsCoin: (v: string) => v,
  getStatsReportSide: jest.fn(),
}));
jest.mock('@/components/Tip', () => ({ Tip: ({ children }: any) => children }));
jest.mock(
  '@/screens/Perps/components/PerpsPositionSection/PerpsRiskLevelPopup',
  () => ({ PerpsRiskLevelPopup: () => null }),
);
jest.mock('./PerpsEditMarginPopup', () => ({
  PerpsEditMarginPopup: () => null,
}));
jest.mock('./PerpEditTpSlPriceTag', () => ({
  PerpEditTpSlPriceTag: (props: object) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'tp-sl-tag',
    }),
}));

const props: React.ComponentProps<typeof PerpsPosition> = {
  showRiskPopup: false,
  setShowRiskPopup: jest.fn(),
  handleActionApproveStatus: jest.fn(async () => {}),
  positionData: {
    pnl: 12,
    positionValue: 110,
    size: 1,
    marginUsed: 20,
    leverage: 5,
    type: 'cross',
    entryPrice: 100,
    liquidationPrice: '-20.00',
    autoClose: false,
    direction: 'Long',
    pnlPercent: 12.5,
    fundingPayments: '0',
  },
  rawLiquidationPrice: '-20',
  liquidationPriceText: '--',
  rawMarkPrice: '110',
  coin: 'ETH',
  coinLogo: '',
  leverageMax: 20,
  availableBalance: 100,
  pxDecimals: 2,
  szDecimals: 3,
  markPrice: 110,
  activeAssetCtx: null,
  currentAssetCtx: null,
  handleSetAutoClose: jest.fn(async () => true),
  handleCancelAutoClose: jest.fn(async () => {}),
  handleUpdateMargin: jest.fn(async () => {}),
};

it.each([
  ['54321.6789', 0, '54,322'],
  ['23.4500', 3, '23.45'],
  ['23.4565', 3, '23.457'],
] as const)(
  'displays the shared liquidation text for %s without changing editor inputs',
  (raw, decimals, expected) => {
    const legacyPrice = Number(raw).toFixed(decimals || 2);
    const ui = render(
      <PerpsPosition
        {...props}
        rawLiquidationPrice={raw}
        liquidationPriceText={simpleLiquidationPriceText(raw, decimals)}
        positionData={{ ...props.positionData!, liquidationPrice: legacyPrice }}
      />,
    );
    expect(ui.getByText(`$${expected}`)).toBeTruthy();
    for (const tag of ui.getAllByTestId('tp-sl-tag')) {
      expect(tag.props.liqPrice).toBe(Number(legacyPrice));
    }
  },
);

it.each(['cross', 'isolated'] as const)(
  'keeps gap and Size information in %s',
  async type => {
    const ui = render(
      <PerpsPosition
        {...props}
        positionData={{ ...props.positionData!, type }}
      />,
    );
    expect(ui.getByText('+12.50%')).toBeTruthy();
    expect(ui.getByText('-100.00%')).toHaveStyle({ color: 'neutral-title-1' });
    expect(
      ui.getByText('page.perpsDetail.simpleAccount.estimatedLiquidationPrice'),
    ).toBeTruthy();
    expect(
      ui.getByText(
        'page.perpsDetail.simpleAccount.estimatedLiquidationDistance',
      ),
    ).toBeTruthy();
    fireEvent.press(ui.getByText('page.perpsDetail.PerpsPosition.size'));
    expect(mockTips).toHaveBeenCalledWith(
      expect.objectContaining({
        desc: 'page.perpsDetail.PerpsPosition.sizeTips',
      }),
    );
    expect(
      ui.queryAllByRole('button', {
        name: 'page.perpsDetail.simpleAccount.margin',
      }),
    ).toHaveLength(type === 'isolated' ? 1 : 0);
    if (type === 'isolated')
      await act(async () =>
        fireEvent.press(
          ui.getByRole('button', {
            name: 'page.perpsDetail.simpleAccount.margin',
          }),
        ),
      );
  },
);

it.each([
  ['', ''],
  ['120', ''],
  ['', '80'],
  ['120', '80'],
])('passes TP=%s SL=%s to the original actions', async (tpPrice, slPrice) => {
  const cancel = jest.fn(async () => {});
  const ui = render(
    <PerpsPosition
      {...props}
      tpPrice={tpPrice}
      slPrice={slPrice}
      handleCancelAutoClose={cancel}
    />,
  );
  const tags = ui.getAllByTestId('tp-sl-tag');
  expect(tags[0].props).toMatchObject({
    variant: 'position',
    initTpOrSlPrice: tpPrice,
    estimatedPnl: tpPrice ? 20 : null,
  });
  expect(tags[1].props).toMatchObject({
    variant: 'position',
    initTpOrSlPrice: slPrice,
    estimatedPnl: slPrice ? -20 : null,
  });
  await act(async () => tags[0].props.handleCancelAutoClose());
  expect(cancel).toHaveBeenCalledWith('tp');
});

it('spans the divider across the card content with symmetric insets', () => {
  const ui = render(<PerpsPosition {...props} />);
  const divider = ui.getByTestId('perps-position-divider');
  expect(divider).toHaveStyle({ marginVertical: 12 });
  expect(divider.props.style).not.toHaveProperty('marginRight');
  expect(divider.props.style).not.toHaveProperty('marginLeft');
  expect(divider.props.style).not.toHaveProperty('marginHorizontal');
});
