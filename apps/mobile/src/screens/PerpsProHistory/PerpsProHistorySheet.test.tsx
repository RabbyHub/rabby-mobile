import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockHideFeeTips = jest.fn();
const mockSheetProps = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 47 }),
}));

jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (
        { children, ...props }: { children?: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        mockSheetProps(props);
        ReactModule.useImperativeHandle(ref, () => ({
          dismiss: mockDismiss,
          present: mockPresent,
        }));
        return ReactModule.createElement(
          View,
          { testID: 'mock-history-bottom-sheet' },
          children,
        );
      },
    ),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/hooks/useTipsPopup', () => ({
  useHideTipsPopup: () => mockHideFeeTips,
  useIsTipsPopupVisible: () => false,
}));

jest.mock(
  '@/screens/PerpsPro/components/common/perpsProSheetNavigationRegistry',
  () => ({
    usePerpsProSheetNavigationRegistration: jest.fn(),
  }),
);

jest.mock('@/screens/PerpsPro/components/common/perpsProVisual', () => ({
  PERPS_PRO_FONT_FAMILY: 'SF Pro Rounded',
  getPerpsProFontStyle: () => ({ fontFamily: 'SF Pro Rounded Heavy' }),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./components/PerpsProHistoryContent', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProHistoryContent: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'mock-history-content',
      }),
  };
});

import {
  getPerpsProHistorySheetHeight,
  PerpsProHistorySheetHost,
  type PerpsProHistorySheetHostRef,
} from './PerpsProHistorySheet';

const getLatestSheetProps = () =>
  mockSheetProps.mock.calls.at(-1)?.[0] as {
    onAnimate: (fromIndex: number, toIndex: number) => void;
    onDismiss: () => void;
    snapPoints: number[];
  };

describe('PerpsProHistorySheetHost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('caps the Figma sheet and clamps it below the safe-area top', () => {
    expect(
      getPerpsProHistorySheetHeight({ topInset: 47, windowHeight: 852 }),
    ).toBe(748);
    expect(
      getPerpsProHistorySheetHeight({ topInset: 44, windowHeight: 667 }),
    ).toBe(607);
  });

  it('creates one session for rapid repeated present and unmounts on dismiss', () => {
    const ref = React.createRef<PerpsProHistorySheetHostRef>();
    render(<PerpsProHistorySheetHost ref={ref} />);

    act(() => {
      ref.current?.present('orders');
      ref.current?.present('funding');
    });

    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('mock-history-content').props).toMatchObject({
      active: true,
      initialTab: 'orders',
      scrollHost: 'bottomSheet',
    });
    expect(getLatestSheetProps().snapPoints).toEqual([748]);
    expect(
      StyleSheet.flatten(
        screen.getByText('page.perps.pro.history.title').props.style,
      ),
    ).toEqual(
      expect.objectContaining({
        fontSize: 20,
        lineHeight: 24,
        textAlign: 'center',
      }),
    );

    act(() => getLatestSheetProps().onAnimate(0, -1));
    expect(screen.getByTestId('mock-history-content').props.active).toBe(false);
    expect(screen.getByTestId('perps-pro-history-sheet')).toBeOnTheScreen();

    act(() => getLatestSheetProps().onAnimate(-1, 0));
    expect(screen.getByTestId('mock-history-content').props.active).toBe(true);

    act(() => getLatestSheetProps().onAnimate(0, -1));
    expect(screen.getByTestId('mock-history-content').props.active).toBe(false);

    act(() => getLatestSheetProps().onDismiss());
    expect(screen.queryByTestId('perps-pro-history-sheet')).toBeNull();

    act(() => ref.current?.present('funding'));
    expect(mockPresent).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('mock-history-content').props.initialTab).toBe(
      'funding',
    );
  });

  it('cancels an opening session synchronously before native presentation', () => {
    const ref = React.createRef<PerpsProHistorySheetHostRef>();
    render(<PerpsProHistorySheetHost ref={ref} />);

    act(() => {
      ref.current?.present('transaction');
      ref.current?.dismiss();
    });

    expect(mockPresent).not.toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(screen.queryByTestId('perps-pro-history-sheet')).toBeNull();
  });
});
