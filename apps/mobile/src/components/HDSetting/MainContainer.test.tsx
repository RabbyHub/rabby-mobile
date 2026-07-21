import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

let mockFooterButtonProps:
  | {
      disabled?: boolean;
      onPress: () => void | Promise<void>;
    }
  | undefined;

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    styles: new Proxy({}, { get: () => ({}) }),
  }),
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { Pressable, TextInput } = require('react-native');

  return {
    BottomSheetTextInput: TextInput,
    TouchableOpacity: Pressable,
  };
});

jest.mock('@/components/customized/BottomSheet', () => ({
  AppBottomSheetModalTitle: () => null,
}));

jest.mock('@/components2024/FooterButton/FooterButton', () => {
  const React = require('react');
  const { Pressable } = require('react-native');

  return {
    FooterButton: (props: typeof mockFooterButtonProps) => {
      mockFooterButtonProps = props;
      return (
        <Pressable
          testID="confirm-hd-setting"
          disabled={props?.disabled}
          onPress={props?.onPress}
        />
      );
    },
  };
});

jest.mock('@/components2024/Radio', () => ({ Radio: () => null }));
jest.mock('@/components/Spin', () => ({
  Spin: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/AutoLockView', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('./util', () => ({
  fetchAccountsInfo: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { MainContainer } =
  require('./MainContainer') as typeof import('./MainContainer');

describe('HD setting confirmation', () => {
  beforeEach(() => {
    mockFooterButtonProps = undefined;
  });

  it('re-enables confirm when an async device setting fails', async () => {
    let rejectSetting = (_error: Error) => undefined;
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSetting = reject;
        }),
    );
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(
      <MainContainer
        hdPathOptions={[]}
        setting={{ hdPath: 'LedgerLive' as never, startNumber: 1 }}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.press(screen.getByTestId('confirm-hd-setting'));

    await waitFor(() => {
      expect(mockFooterButtonProps?.disabled).toBe(true);
    });

    await act(async () => {
      rejectSetting(new Error('Ledger disconnected'));
    });

    await waitFor(() => {
      expect(mockFooterButtonProps?.disabled).toBe(false);
    });
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
