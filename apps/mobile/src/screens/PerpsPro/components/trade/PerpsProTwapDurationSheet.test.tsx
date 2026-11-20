import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { DurationPickerCommands } from '@rabby-wallet/react-native-duration-picker';
import type { PerpsProTradeController } from '../../scene/usePerpsProTrade';
import { PerpsProTwapDurationSheet } from './PerpsProTwapDurationSheet';
import { PerpsProTwapFields } from './PerpsProTwapFields';
import { triggerPerpsProLightHaptic } from '../common/triggerPerpsProLightHaptic';

jest.mock('../common/triggerPerpsProLightHaptic', () => ({
  triggerPerpsProLightHaptic: jest.fn(),
}));

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
  'uses %s minute units and starts and resets at five minutes',
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
          value=""
          onClose={jest.fn()}
          onConfirm={onConfirm}
        />
      </I18nextProvider>,
    );
    expect(screen.getByText(fieldLabel)).toBeTruthy();
    const wheel = screen.getByTestId('native-wheel');
    expect(wheel.props.minimumDurationMinutes).toBe(5);
    expect(wheel.props.durationMinutes).toBe(5);
    expect(onConfirm).not.toHaveBeenCalled();
    for (const [i, value] of [0, 1, 2, 59].entries()) {
      expect(wheel.props.minuteLabels[value]).toBe(expected[i]);
      fireEvent(wheel, 'durationChange', {
        nativeEvent: { minutes: 60 + value, sessionId: wheel.props.sessionId },
      });
      expect(screen.getByText(expected[i]!)).toBeTruthy();
    }
    fireEvent.press(screen.getByText(i18n.t('page.perps.pro.twap.reset')));
    expect(wheel.props.durationMinutes).toBe(5);
    expect(
      screen.getByText(
        i18n.t('page.perps.pro.twap.minuteValue', { count: 5, t: '\u20075' }),
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(i18n.t('page.perps.pro.twap.errors.durationTooShort')),
    ).toBeNull();
    fireEvent.press(screen.getByText(i18n.t('global.confirm')));
    const requestId = jest.mocked(DurationPickerCommands.readCurrentValue).mock
      .lastCall?.[1];
    expect(requestId).toBeDefined();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent(wheel, 'valueRead', {
      nativeEvent: { minutes: 5, sessionId: wheel.props.sessionId, requestId },
    });
    expect(onConfirm).toHaveBeenCalledWith('5');
  },
);

it('gates and throttles user haptics across reset, confirm and visibility changes', async () => {
  const i18n = createInstance();
  await i18n.init({
    lng: 'en',
    resources: {
      en: { translation: require('@/assets/locales/en/messages.json') },
    },
  });
  const onConfirm = jest.fn();
  const haptic = jest.mocked(triggerPerpsProLightHaptic);
  haptic.mockClear();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
  const content = (visible: boolean) => (
    <I18nextProvider i18n={i18n}>
      <PerpsProTwapDurationSheet
        visible={visible}
        value="61"
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />
    </I18nextProvider>
  );
  try {
    const view = render(content(true));
    const wheel = screen.getByTestId('native-wheel');
    const firstSession = wheel.props.sessionId;
    const change = (minutes: number, sessionId = wheel.props.sessionId) =>
      fireEvent(wheel, 'durationChange', {
        nativeEvent: { minutes, sessionId },
      });
    expect(haptic).not.toHaveBeenCalled();
    change(61);
    change(62, firstSession - 1);
    expect(haptic).not.toHaveBeenCalled();
    change(62);
    expect(haptic).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(1040);
    change(63);
    expect(haptic).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(1080);
    change(64);
    expect(haptic).toHaveBeenCalledTimes(2);

    fireEvent.press(screen.getByText('Reset'));
    change(65, firstSession);
    expect(wheel.props.durationMinutes).toBe(5);
    expect(haptic).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(1200);
    change(5);
    expect(haptic).toHaveBeenCalledTimes(2);
    change(6);
    expect(haptic).toHaveBeenCalledTimes(3);

    fireEvent.press(screen.getByText('Confirm'));
    clock.mockReturnValue(1400);
    change(6);
    const requestId = jest.mocked(DurationPickerCommands.readCurrentValue).mock
      .lastCall?.[1];
    fireEvent(wheel, 'valueRead', {
      nativeEvent: { minutes: 7, sessionId: wheel.props.sessionId, requestId },
    });
    expect(onConfirm).toHaveBeenCalledWith('7');
    expect(haptic).toHaveBeenCalledTimes(3);
    view.rerender(content(false));
    change(8);
    view.rerender(content(true));
    change(61);
    expect(haptic).toHaveBeenCalledTimes(3);
  } finally {
    clock.mockRestore();
  }
});
