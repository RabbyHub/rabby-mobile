import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet, TouchableNativeFeedback } from 'react-native';
import type { ParseTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import type { SafeMessage } from '@rabby-wallet/gnosis-sdk';
import { GnosisTransactionExplain } from './GnosisTransactionQueue/GnosisTransactionExplain';
import { GnosisMessageExplain } from './GnosisMessageQueue/GnosisMessageExplain';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'page.safeQueue.viewBtn' ? 'View' : key),
  }),
}));
jest.mock('@/hooks/theme', () => ({
  useGetBinaryMode: () => 'light',
  useThemeColors: () => ({
    'blue-default': '#7084ff',
    'neutral-title2': '#ffffff',
    'neutral-title-1': '#192945',
  }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles: (getStyle: unknown) => getStyle,
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('react-native-size-matters', () => ({
  moderateScale: (value: number) => value,
}));
jest.mock('@rneui/themed', () => ({ Skeleton: () => null }));
jest.mock('@/assets/icons/gnosis', () => ({ RcIconUser: () => null }));
jest.mock('@/screens/Approvals/icons', () => ({ RcIconUnknown: () => null }));
jest.mock('@/constant', () => ({ INTERNAL_REQUEST_ORIGIN: 'test-origin' }));
jest.mock('@/core/request', () => ({ openapi: {} }));
jest.mock('@/utils/number', () => ({ splitNumberByStep: jest.fn() }));
jest.mock('@/utils/token', () => ({ getTokenSymbol: jest.fn() }));
jest.mock('@/components/Approval/components/Actions/utils', () => ({
  getActionTypeTextByType: () => 'Swap Token',
}));
jest.mock('@/components/Approval/components/TextActions/utils', () => ({
  getActionTypeText: jest.fn(),
}));
jest.mock('@/components/Approval/components/TypedDataActions/utils', () => ({
  getActionTypeText: jest.fn(),
}));
jest.mock('@rabby-wallet/rabby-action', () => ({
  getProtocol: jest.fn(),
  parseAction: jest.fn(),
}));
jest.mock('ahooks', () => ({
  useRequest: () => ({ data: undefined, loading: false }),
}));

const explain = {
  action: { type: 'cancel_tx' },
} as ParseTxResponse;
const message = {
  message: 'Test message',
  safe: '0x0000000000000000000000000000000000000001',
} as SafeMessage;

const originalPlatform = Platform.OS;

// Component tests keep the real legacy Button -> renderText -> Text path.
// Parsing/network collaborators are outside this style/press-routing contract.
// Native Fabric glyph measurement and clipping still require a device check.
describe.each(['transaction', 'message'] as const)(
  'Safe %s View button',
  kind => {
    beforeEach(() => {
      Platform.OS = 'android';
      jest
        .spyOn(Platform, 'select')
        .mockImplementation(options => options.android);
    });

    afterEach(() => {
      Platform.OS = originalPlatform;
      jest.restoreAllMocks();
    });

    const renderExplain = (
      onView: () => void,
      loading = false,
      canExec = false,
    ) =>
      kind === 'transaction' ? (
        <GnosisTransactionExplain
          explain={explain}
          serverId="eth"
          isViewLoading={loading}
          onView={onView}
          canExec={canExec}
        />
      ) : (
        <GnosisMessageExplain
          data={message}
          isViewLoading={loading}
          onView={onView}
        />
      );

    it('preserves compact button sizing and the existing title typography', () => {
      render(renderExplain(jest.fn()));
      const buttonStyle = StyleSheet.flatten(
        screen.getByRole('button').props.style,
      );
      const titleStyle = StyleSheet.flatten(
        screen.getByText('View').props.style,
      );

      expect(buttonStyle).toMatchObject({
        width: 60,
        height: 26,
        borderWidth: 1,
      });
      expect(titleStyle).toMatchObject({
        lineHeight: 22,
        fontWeight: '500',
      });
    });

    it('preserves title contrast and foreground feedback as execution becomes available', () => {
      const view = render(renderExplain(jest.fn()));

      for (const canExec of [false, true, false]) {
        view.rerender(renderExplain(jest.fn(), false, canExec));
        const isSubmittable = kind === 'message' || canExec;
        const button = screen.getByRole('button');
        const backgroundColor = StyleSheet.flatten(
          button.props.style,
        ).backgroundColor;
        expect(
          StyleSheet.flatten(screen.getByText('View').props.style).color,
        ).toBe(isSubmittable ? '#7084ff' : '#ffffff');
        expect(backgroundColor).toBe(
          isSubmittable ? 'rgba(134, 151, 255, 0.2)' : '#7084ff',
        );
        expect(button.props.nativeForegroundAndroid).toBeTruthy();
        expect(button.props.nativeBackgroundAndroid).toBeUndefined();
        expect(
          screen.UNSAFE_getByType(TouchableNativeFeedback).props.useForeground,
        ).toBe(true);
      }
    });

    it('opens the view only while ready and restores its title after loading', () => {
      const onView = jest.fn();
      const view = render(renderExplain(onView));
      fireEvent.press(screen.getByRole('button'));
      expect(onView).toHaveBeenCalledTimes(1);

      view.rerender(renderExplain(onView, true));
      expect(screen.queryByText('View')).toBeNull();
      fireEvent.press(screen.getByRole('button'));
      expect(onView).toHaveBeenCalledTimes(1);

      view.rerender(renderExplain(onView));
      expect(screen.getByText('View')).toBeTruthy();
      fireEvent.press(screen.getByRole('button'));
      expect(onView).toHaveBeenCalledTimes(2);
    });
  },
);
