import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MemeCoinHomeBottomBar } from './MemeCoinHomeBottomBar';

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/Typography', () => ({
  Text: jest.requireActual('react-native').Text,
  TextInput: jest.requireActual('react-native').TextInput,
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/utils/perpsPriceProtocol', () => ({
  sanitizePerpsProDecimalEditingInput: (text: string) => text,
}));
jest.mock('@/assets/icons/common', () => ({ RcNextSearchCC: () => null }));
jest.mock('@/components2024/SearchBar', () => ({ NextSearchBar: () => null }));
jest.mock('@/components2024/Button', () => {
  const { createElement } = jest.requireActual('react');
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    Button: ({
      title,
      onPress,
      disabled,
    }: {
      title: string;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      createElement(
        TouchableOpacity,
        { onPress, disabled },
        createElement(Text, null, title),
      ),
  };
});
jest.mock('@/constant/layout', () => ({
  BOTTOM_BUTTON_GAP: 12,
  BOTTOM_BUTTON_SINGLE_HEIGHT: 52,
  BOTTOM_BUTTON_TOP_OFFSET: 12,
  getBottomButtonBottomOffset: () => 36,
  getBottomButtonCenteredTitleStyle: () => ({}),
}));
jest.mock('@/core/native/utils', () => ({ IS_IOS: true }));
jest.mock('@/hooks/useAppLayout', () => ({
  useSafeSizes: () => ({ safeOffBottom: 0 }),
}));
jest.mock('../components/MaxPriceImpactSelector', () => ({
  MaxPriceImpactSelector: () => null,
}));

const renderBar = (
  over: Partial<React.ComponentProps<typeof MemeCoinHomeBottomBar>>,
) => {
  const onCancelSelection = jest.fn();
  const utils = render(
    <MemeCoinHomeBottomBar
      mode="market"
      selectedCount={2}
      searching={false}
      onStartSearch={jest.fn()}
      onCancelSearch={jest.fn()}
      keyword=""
      onKeywordChange={jest.fn()}
      amountText=""
      onChangeAmount={jest.fn()}
      buyDisabled
      maxPriceImpactPct={5}
      onMaxPriceImpactChange={jest.fn()}
      onBuy={jest.fn()}
      onSell={jest.fn()}
      onCancelSelection={onCancelSelection}
      {...over}
    />,
  );
  return { ...utils, onCancelSelection };
};

describe('MemeCoinHomeBottomBar', () => {
  it.each(['market', 'holdings'] as const)(
    'cancels the selection in %s mode, even with Buy disabled',
    mode => {
      const { getByText, onCancelSelection } = renderBar({ mode });
      fireEvent.press(getByText('page.memeCoin.cancel'));
      expect(onCancelSelection).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['market', 'holdings'] as const)(
    'has no cancel without a selection in %s mode',
    mode => {
      const { queryByText } = renderBar({ mode, selectedCount: 0 });
      expect(queryByText('page.memeCoin.cancel')).toBeNull();
    },
  );

  it('offers no quick amounts', () => {
    const { queryByText } = renderBar({});
    ['50', '100', '500', '1,000'].forEach(label =>
      expect(queryByText(label)).toBeNull(),
    );
  });
});
