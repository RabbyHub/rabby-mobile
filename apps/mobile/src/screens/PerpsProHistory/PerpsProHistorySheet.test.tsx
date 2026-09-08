import { act, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockHideFeeTips = jest.fn();
const mockSheetProps = jest.fn();
const mockSetActiveTab = jest.fn();
const mockUseHistoryController = jest.fn(() => ({
  activeTab: 'orders',
  loadEarlier: jest.fn(),
  refresh: jest.fn(),
  setActiveTab: mockSetActiveTab,
  state: {},
}));

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

jest.mock('@/components/customized/BottomSheetHandle', () => ({
  BottomSheetHandlableView: require('react-native').View,
}));

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

jest.mock('./scene/usePerpsProHistoryController', () => ({
  usePerpsProHistoryController: (...args: unknown[]) =>
    mockUseHistoryController(...args),
}));

jest.mock('./components/PerpsProHistoryContent', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProHistoryContentView: (props: object) =>
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
    enableContentPanningGesture: boolean;
    enablePanDownToClose: boolean;
    onAnimate: (fromIndex: number, toIndex: number) => void;
    onDismiss: () => void;
    snapPoints: number[];
  };

describe('PerpsProHistorySheetHost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps one deferred preload controller mounted outside sheet sessions', () => {
    render(<PerpsProHistorySheetHost ref={React.createRef()} />);

    expect(mockUseHistoryController).toHaveBeenCalledWith(
      'orders',
      false,
      true,
      true,
    );
    expect(screen.queryByTestId('mock-history-content')).toBeNull();
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
      scrollHost: 'bottomSheet',
    });
    expect(mockSetActiveTab).toHaveBeenCalledWith('orders');
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
    const titleDragRegion = screen.getByTestId(
      'perps-pro-history-sheet-title-drag-region',
    );
    expect(
      within(titleDragRegion).getByText('page.perps.pro.history.title'),
    ).toBeTruthy();
    expect(titleDragRegion.props.accessible).toBe(false);
    expect(StyleSheet.flatten(titleDragRegion.props.style)).toMatchObject({
      height: 56,
      paddingBottom: 20,
      paddingHorizontal: 16,
      paddingTop: 12,
    });
    expect(getLatestSheetProps().enableContentPanningGesture).toBe(false);
    expect(getLatestSheetProps().enablePanDownToClose).toBe(true);

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
    expect(mockSetActiveTab).toHaveBeenLastCalledWith('funding');
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
