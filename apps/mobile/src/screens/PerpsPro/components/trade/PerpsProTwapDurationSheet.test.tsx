import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { DurationPickerCommands } from '@rabby-wallet/react-native-duration-picker';
import type { PerpsProTradeController } from '../../scene/usePerpsProTrade';
import { PerpsProTwapDurationSheet } from './PerpsProTwapDurationSheet';
import { PerpsProTwapFields } from './PerpsProTwapFields';

jest.mock('@rabby-wallet/react-native-duration-picker', () => ({
  DurationPicker: require('react').forwardRef(
    (props: object, ref: React.Ref<object>) => {
      const React = require('react');
      React.useImperativeHandle(ref, () => ({}));
      return React.createElement(require('react-native').View, {
        ...props,
        testID: 'native-wheel',
      });
    },
  ),
  DurationPickerCommands: { readCurrentValue: jest.fn() },
}));
jest.mock(
  '@/assets2024/icons/perps/PerpsProTpSlTooltipTail.svg',
  () => require('react-native').View,
);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/AutoLockView', () => require('react-native').View);
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
}));
jest.mock('@/components/customized/BottomSheet', () => ({
  AppBottomSheetModal: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/components2024/Button', () => ({
  Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
    require('react').createElement(
      require('react-native').Text,
      { onPress },
      title,
    ),
}));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('../common/PerpsProDialogBackdrop', () => ({
  PerpsProDialogBackdrop: () => null,
}));
jest.mock('../common/perpsProSheetNavigationRegistry', () => ({
  usePerpsProSheetNavigationRegistration: () => {},
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (ctx: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({
        colors2024,
        isLight: true,
        safeAreaInsets: { bottom: 0 },
      }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (factory: unknown) => factory,
}));

it.each([
  ['en', ['0 mins', '1 min', '2 mins', '59 mins'], '1 hour : 1 min'],
  ['zh-CN', ['0 分钟', '1 分钟', '2 分钟', '59 分钟'], '1 小时 : 1 分钟'],
] as const)(
  'uses %s minute units in the wheel, preview and order field',
  async (language, expected, fieldLabel) => {
    const i18n = createInstance();
    await i18n.init({
      lng: language,
      resources: {
        en: { translation: require('@/assets/locales/en/messages.json') },
        'zh-CN': {
          translation: require('@/assets/locales/zh-CN/messages.json'),
        },
      },
    });
    const controller = {
      form: { twapDuration: '61' },
    } as PerpsProTradeController;
    const onConfirm = jest.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <PerpsProTwapFields controller={controller} onSelectTime={jest.fn()} />
        <PerpsProTwapDurationSheet
          visible
          value="61"
          onClose={jest.fn()}
          onConfirm={onConfirm}
        />
      </I18nextProvider>,
    );
    expect(screen.getByText(fieldLabel)).toBeTruthy();
    const wheel = screen.getByTestId('native-wheel');
    for (const [i, value] of [0, 1, 2, 59].entries()) {
      expect(wheel.props.minuteLabels[value]).toBe(expected[i]);
      fireEvent(wheel, 'durationChange', {
        nativeEvent: { minutes: 60 + value, sessionId: wheel.props.sessionId },
      });
      expect(screen.getByText(expected[i]!)).toBeTruthy();
    }
    fireEvent.press(screen.getByText(i18n.t('page.perps.pro.twap.reset')));
    expect(wheel.props.durationMinutes).toBe(0);
    expect(
      screen.getByText(
        i18n.t('page.perps.pro.twap.minuteValue', { t: '' }).trim(),
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByText(i18n.t('global.confirm')));
    const requestId = jest.mocked(DurationPickerCommands.readCurrentValue).mock
      .lastCall?.[1];
    expect(requestId).toBeDefined();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent(wheel, 'valueRead', {
      nativeEvent: { minutes: 62, sessionId: wheel.props.sessionId, requestId },
    });
    expect(onConfirm).toHaveBeenCalledWith('62');
  },
);
