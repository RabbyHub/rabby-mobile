import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import {
  getTopPerpsProSheetNavigationRegistration,
  requestDismissPerpsProSheet,
  resetPerpsProSheetNavigationGuardForTests,
} from './components/common/perpsProSheetNavigationRegistry';
import { PerpsProScreen } from './index';

const mockPresentHistory = jest.fn();
const mockHidePortfolioBreakdown = jest.fn();
let mockPortfolioBreakdownVisible = false;
let mockSceneRenderCount = 0;

jest.mock(
  '@/screens/PerpsProHistory/repository/perpsProHistoryRepository',
  () => ({
    isPerpsProHistorySdkSupported: () => true,
  }),
);

jest.mock('./components/common/PerpsProSheetNavigationGuard', () => ({
  PerpsProSheetNavigationHost: () => null,
}));

jest.mock('@/screens/PerpsProHistory/PerpsProHistorySheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProHistorySheetHost: ReactModule.forwardRef(
      (_props: Record<string, never>, ref: React.Ref<unknown>) => {
        const [open, setOpen] = ReactModule.useState(false);
        ReactModule.useImperativeHandle(ref, () => ({
          dismiss: jest.fn(),
          present: (initialTab: string) => {
            mockPresentHistory(initialTab);
            setOpen(true);
          },
        }));
        return ReactModule.createElement(View, {
          accessibilityLabel: String(open),
          testID: 'perps-pro-history-sheet-host',
        });
      },
    ),
  };
});

jest.mock('@/components2024/ScreenContainer/NormalScreenContainer', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return ({
    children,
    noHeader,
    type,
  }: {
    children: React.ReactNode;
    noHeader?: boolean;
    type?: string;
  }) =>
    ReactModule.createElement(
      View,
      {
        accessibilityLabel: `${String(noHeader)}:${String(type)}`,
        testID: 'screen-container',
      },
      children,
    );
});

jest.mock('@/hooks/useTipsPopup', () => ({
  useHideTipsPopup: () => mockHidePortfolioBreakdown,
  useIsTipsPopupVisible: () => mockPortfolioBreakdownVisible,
}));

jest.mock('./scene/PerpsProScene', () => {
  const ReactModule = require('react');
  const { Pressable, View } = require('react-native');
  return {
    PerpsProScene: ({
      historyEnabled,
      initialRegionAlertLayout,
      isModeSwitching,
      onOpenHistory,
      onSwitchToSimple,
    }: {
      historyEnabled: boolean;
      initialRegionAlertLayout?: { height: number; width: number } | null;
      isModeSwitching: boolean;
      onOpenHistory: (hasPendingFunding: boolean) => void;
      onSwitchToSimple: () => void;
    }) => {
      mockSceneRenderCount += 1;
      return ReactModule.createElement(
        View,
        {
          accessibilityLabel: initialRegionAlertLayout
            ? `${initialRegionAlertLayout.width}:${initialRegionAlertLayout.height}`
            : 'no-alert-layout',
          testID: 'perps-pro-scene-wrapper',
        },
        ReactModule.createElement(Pressable, {
          accessibilityLabel: 'pro',
          accessibilityState: { disabled: isModeSwitching },
          disabled: isModeSwitching,
          onPress: onSwitchToSimple,
          testID: 'perps-pro-scene',
        }),
        ReactModule.createElement(Pressable, {
          accessibilityState: { disabled: !historyEnabled },
          disabled: !historyEnabled,
          onPress: () => onOpenHistory(false),
          testID: 'perps-pro-history',
        }),
        ReactModule.createElement(Pressable, {
          accessibilityState: { disabled: !historyEnabled },
          disabled: !historyEnabled,
          onPress: () => onOpenHistory(true),
          testID: 'perps-pro-history-pending',
        }),
      );
    },
  };
});

describe('PerpsProScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPortfolioBreakdownVisible = false;
    mockSceneRenderCount = 0;
    resetPerpsProSheetNavigationGuardForTests();
  });

  it('delegates mode and History actions while the outer route owns the header', () => {
    const onSwitchToSimple = jest.fn();
    const screen = render(
      <PerpsProScreen
        initialRegionAlertLayout={{ height: 52, width: 361 }}
        isModeSwitching={false}
        onSwitchToSimple={onSwitchToSimple}
      />,
    );

    expect(
      screen.getByTestId('screen-container').props.accessibilityLabel,
    ).toBe('true:bg1');
    expect(screen.getByTestId('perps-pro-scene').props.accessibilityLabel).toBe(
      'pro',
    );
    expect(
      screen.getByTestId('perps-pro-scene-wrapper').props.accessibilityLabel,
    ).toBe('361:52');

    fireEvent.press(screen.getByTestId('perps-pro-scene'));
    expect(onSwitchToSimple).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('perps-pro-history'));
    expect(mockPresentHistory).toHaveBeenCalledWith('orders');
    expect(
      screen.getByTestId('perps-pro-history-sheet-host').props
        .accessibilityLabel,
    ).toBe('true');
    expect(mockSceneRenderCount).toBe(1);
  });

  it('disables the shared switch while the mode preference is saving', () => {
    const screen = render(
      <PerpsProScreen isModeSwitching onSwitchToSimple={jest.fn()} />,
    );

    expect(
      screen.getByTestId('perps-pro-scene').props.accessibilityState,
    ).toEqual({ disabled: true });
  });

  it('opens Transaction history when a funding operation is pending', () => {
    const screen = render(
      <PerpsProScreen isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-history-pending'));
    expect(mockPresentHistory).toHaveBeenCalledWith('transaction');
  });

  it('registers the owned Portfolio breakdown as the top Pro sheet', () => {
    mockPortfolioBreakdownVisible = true;
    render(
      <PerpsProScreen isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const registration = getTopPerpsProSheetNavigationRegistration();
    expect(registration).not.toBeNull();
    requestDismissPerpsProSheet(registration!, 'edge');
    expect(mockHidePortfolioBreakdown).toHaveBeenCalledTimes(1);
  });
});
