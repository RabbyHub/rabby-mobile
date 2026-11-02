import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

let mockModal: any;
let mockSequence = 0;
let mockFocused = true;
const mockRemove = jest.fn();
const mockNavigation = { isFocused: () => mockFocused };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: (params: any) => {
    mockModal = params;
    return `chain-${++mockSequence}`;
  },
  removeGlobalBottomSheetModal2024: (...args: unknown[]) => mockRemove(...args),
}));
jest.mock('@/components2024/GlobalBottomSheetModal/types', () => ({
  MODAL_NAMES: { SELECT_CHAIN_WITH_SUMMARY: 'chain' },
}));
jest.mock('@/assets2024/icons/common/arrow-right-cc.svg', () => () => null);
jest.mock('@/components/Chain/ChainIconImage', () => () => null);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('@/hooks/useFindChain', () => ({
  useFindChain: () => ({ name: 'Ethereum' }),
}));
jest.mock('@/utils/styles', () => ({ createGetStyles2024: () => () => ({}) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const { ChainInfo2024 } =
  require('./ChainInfo2024') as typeof import('./ChainInfo2024');

beforeEach(() => {
  mockRemove.mockClear();
  mockFocused = true;
});

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Simple Key Pair',
};

function setup() {
  const onChange = jest.fn();
  const view = render(
    <ChainInfo2024
      account={account as any}
      chainEnum={'ETH' as any}
      onChange={onChange}
    />,
  );
  fireEvent.press(screen.getByText('Ethereum'));
  return { ...view, onChange, modal: mockModal };
}

it('finishes native dismissal before changing the chain, once', () => {
  const { onChange, modal } = setup();
  act(() => {
    modal.onChange('ARBITRUM');
    modal.onChange('BASE');
  });
  expect(mockRemove).toHaveBeenCalledTimes(1);
  expect(mockRemove).toHaveBeenCalledWith(expect.any(String), {
    waitForDismiss: true,
  });
  expect(onChange).not.toHaveBeenCalled();
  act(() => modal.bottomSheetModalProps.onDismiss());
  act(() => modal.bottomSheetModalProps.onDismiss());
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('ARBITRUM');
});

it.each(['close', 'backdrop', 'blur', 'unmount', 'replace'])(
  'ignores an obsolete selection after %s',
  reason => {
    const { onChange, modal, unmount } = setup();
    if (reason !== 'close' && reason !== 'backdrop')
      act(() => modal.onChange('ARBITRUM'));
    if (reason === 'close') act(() => modal.onClose());
    if (reason === 'blur') mockFocused = false;
    if (reason === 'unmount') unmount();
    if (reason === 'replace') fireEvent.press(screen.getByText('Ethereum'));
    act(() => modal.bottomSheetModalProps.onDismiss?.());
    expect(onChange).not.toHaveBeenCalled();
  },
);

it.each([
  ['chain', { chainEnum: 'BASE' }],
  [
    'address',
    {
      account: {
        ...account,
        address: '0x2222222222222222222222222222222222222222',
      },
    },
  ],
  ['account type', { account: { ...account, type: 'Ledger Hardware' } }],
  ['brand', { account: { ...account, brandName: 'Other brand' } }],
  ['disabled', { disabled: true }],
])(
  'ignores the pending selection when %s changes before dismissal',
  (_label, changedProps) => {
    const { onChange, modal, rerender } = setup();
    act(() => modal.onChange('ARBITRUM'));
    rerender(
      <ChainInfo2024
        account={account as any}
        chainEnum={'ETH' as any}
        onChange={onChange}
        {...(changedProps as any)}
      />,
    );
    act(() => modal.bottomSheetModalProps.onDismiss());
    expect(onChange).not.toHaveBeenCalled();
  },
);

it('uses the latest callback for the same account identity and unchanged chain', () => {
  const { onChange, modal, rerender } = setup();
  const latestOnChange = jest.fn();
  act(() => modal.onChange('ARBITRUM'));
  rerender(
    <ChainInfo2024
      account={{ ...account, aliasName: 'Renamed wallet' } as any}
      chainEnum={'ETH' as any}
      onChange={latestOnChange}
    />,
  );
  act(() => modal.bottomSheetModalProps.onDismiss());
  expect(onChange).not.toHaveBeenCalled();
  expect(latestOnChange).toHaveBeenCalledTimes(1);
  expect(latestOnChange).toHaveBeenCalledWith('ARBITRUM');
});
