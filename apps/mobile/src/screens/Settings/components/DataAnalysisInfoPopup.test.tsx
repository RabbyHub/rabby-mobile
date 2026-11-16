import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enLocale from '@/assets/locales/en/messages.json';
import { E2E_ID } from '@/constant/e2e';

import { DataAnalysisInfoPopup } from './DataAnalysisInfoPopup';

// Component contract: the real copy and the open/close wiring run for real.
// The bottom sheet itself, theme and leaf visual components are controlled
// boundaries.
const mockPresent = jest.fn();
const mockClose = jest.fn();

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: ({ children }: { children: unknown }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AutoLockView', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/components/customized/BottomSheet', () => ({
  AppBottomSheetModal: ({
    ref,
    children,
  }: {
    ref: unknown;
    children: unknown;
  }) => {
    const ReactModule = require('react');
    ReactModule.useImperativeHandle(ref, () => ({
      present: mockPresent,
      close: mockClose,
    }));
    return children;
  },
}));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/components2024/Button', () => ({
  Button: ({
    title,
    type: _type,
    height: _height,
    titleStyle: _titleStyle,
    ...props
  }: Record<string, unknown>) => {
    const ReactModule = require('react');
    const { Pressable, Text } = require('react-native');
    return ReactModule.createElement(
      Pressable,
      props,
      ReactModule.createElement(Text, null, title),
    );
  },
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { styles: getStyle({ colors2024 }), colors2024 };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/utils/makeTestIDProps', () => ({
  makeTestIDProps: (testID: string) => ({ testID }),
}));

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: 'en-US',
    fallbackLng: 'en-US',
    defaultNS: 'translations',
    resources: { 'en-US': { translations: enLocale } },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DataAnalysisInfoPopup', () => {
  it('opens with the explanation of the setting', () => {
    render(<DataAnalysisInfoPopup visible onClose={jest.fn()} />);

    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Help improve Rabby')).toBeTruthy();
    expect(
      screen.getByText(
        'Share anonymous usage data to help improve Rabby. Collected data is not associated with you or your account.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('I Got it')).toBeTruthy();
  });

  it('asks to close from its button and closes the sheet once hidden', () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <DataAnalysisInfoPopup visible onClose={onClose} />,
    );

    fireEvent.press(
      screen.getByTestId(E2E_ID.settings.dataAnalysisInfoConfirm),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    mockClose.mockClear();
    rerender(<DataAnalysisInfoPopup visible={false} onClose={onClose} />);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
