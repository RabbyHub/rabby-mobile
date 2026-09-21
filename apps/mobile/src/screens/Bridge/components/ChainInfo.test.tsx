import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockCreateGlobalBottomSheetModal2024 = jest.fn();
const mockRemoveGlobalBottomSheetModal2024 = jest.fn();

jest.mock('@/assets2024/icons/common/arrow-right-cc.svg', () => () => null);

jest.mock('@/components/Chain/ChainIconImage', () => () => null);

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: (...args: unknown[]) =>
    mockCreateGlobalBottomSheetModal2024(...args),
  removeGlobalBottomSheetModal2024: (...args: unknown[]) =>
    mockRemoveGlobalBottomSheetModal2024(...args),
}));

jest.mock('@/components2024/GlobalBottomSheetModal/types', () => ({
  MODAL_NAMES: {
    SELECT_CHAIN_WITH_SUMMARY: 'SELECT_CHAIN_WITH_SUMMARY',
  },
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    styles: {},
    colors2024: {},
  }),
}));

jest.mock('@/hooks/useFindChain', () => ({
  useFindChain: () => ({ name: 'Ethereum' }),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: () => () => ({}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const { ChainInfo } = require('./ChainInfo') as typeof import('./ChainInfo');

describe('Bridge ChainInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateGlobalBottomSheetModal2024.mockReturnValue('bridge-chain-modal');
  });

  it('does not emit a change when the current chain is selected again', () => {
    const onChange = jest.fn();

    render(
      <ChainInfo
        type="from"
        chainEnum={'ETH' as any}
        account={{} as any}
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByText('Ethereum'));
    const modalProps = mockCreateGlobalBottomSheetModal2024.mock.calls[0][0];

    act(() => {
      modalProps.onChange('ETH');
    });

    expect(mockRemoveGlobalBottomSheetModal2024).toHaveBeenCalledWith(
      'bridge-chain-modal',
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits a change when a different chain is selected', () => {
    const onChange = jest.fn();

    render(
      <ChainInfo
        type="from"
        chainEnum={'ETH' as any}
        account={{} as any}
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByText('Ethereum'));
    const modalProps = mockCreateGlobalBottomSheetModal2024.mock.calls[0][0];

    act(() => {
      modalProps.onChange('ARBITRUM');
    });

    expect(onChange).toHaveBeenCalledWith('ARBITRUM');
  });
});
