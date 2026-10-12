import React from 'react';
import { act, render } from '@testing-library/react-native';
import { GlobalBottomSheetModal2024 } from './GlobalBottomSheetModal';
import { globalSheetModalEvents } from './event';
import { EVENT_NAMES, MODAL_NAMES, type MODAL_ID } from './types';
import { bottomSheetModalSecurityApis } from './security';

const mockPresent = jest.fn();
const mockClose = jest.fn();
const mockGetApproval = jest.fn(async () => undefined);
jest.mock('@/hooks/useApproval', () => ({
  useApproval: () => [mockGetApproval],
}));
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  return {
    AppBottomSheetModal: ReactModule.forwardRef((props: any, ref: any) => {
      ReactModule.useImperativeHandle(ref, () => ({
        present: mockPresent,
        close: mockClose,
      }));
      return props.children;
    }),
  };
});
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
  BottomSheetScrollView: require('react-native').ScrollView,
}));
jest.mock('./utils', () => ({
  MODAL_CONFIGS: {
    WALLETCONNECT_PAIRING: { Component: () => null, snapPoints: [300] },
  },
}));
jest.mock('./utils-help', () => ({ makeBottomSheetProps: () => ({}) }));
jest.mock('@/hooks/useAppGesture', () => ({
  useHandleBackPressClosable: () => undefined,
}));
jest.mock('@/components/AutoLockView', () => ({
  useRefreshAutoLockPanResponder: () => ({ panResponder: { panHandlers: {} } }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ colors2024: {} }),
}));
jest.mock('@/hooks/useAppLayout', () => ({}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock('@/components/Approval/components/map', () => ({
  APPROVAL_SNAP_POINTS: {},
}));
jest.mock('./security', () => ({
  bottomSheetModalSecurityApis: {
    removeAtSensitiveModal: jest.fn(),
    markAtSensitiveModal: jest.fn(),
  },
}));
jest.mock('@/components/Screenshot/hooks', () => ({
  storeApiScreenshotReport: { markIsScreenshotReportFree: jest.fn() },
}));
jest.mock('@/core/utils/startupScheduler', () => ({
  runStartupTask: jest.fn(),
}));
jest.mock('@/core/utils/startupTaskManifest', () => ({ STARTUP_TASKS: {} }));
jest.mock('@/core/utils/perf', () => ({ perfEvents: {} }));

it.each([false, true])(
  'presents once after commit without a timer (strict=%s)',
  async strict => {
    mockPresent.mockClear();
    mockClose.mockClear();
    jest.useFakeTimers();
    const presented = jest.fn();
    const id: MODAL_ID = 'WALLETCONNECT_PAIRING_commit-test';
    globalSheetModalEvents.on(EVENT_NAMES.PRESENTED, presented);
    const view = render(
      strict ? (
        <React.StrictMode>
          <GlobalBottomSheetModal2024 />
        </React.StrictMode>
      ) : (
        <GlobalBottomSheetModal2024 />
      ),
    );
    try {
      await act(async () => {
        globalSheetModalEvents.emit(EVENT_NAMES.CREATE, id, {
          name: MODAL_NAMES.WALLETCONNECT_PAIRING,
          preventScreenshotOnModalOpen: true,
        });
        await Promise.resolve();
      });
      // No runAllTimers: availability of the committed ref drives presentation.
      expect(mockPresent).toHaveBeenCalledTimes(1);
      expect(
        (bottomSheetModalSecurityApis.markAtSensitiveModal as jest.Mock).mock
          .invocationCallOrder[0],
      ).toBeLessThan(mockPresent.mock.invocationCallOrder[0]);
      expect(presented).toHaveBeenCalledTimes(1);
      expect(presented).toHaveBeenCalledWith(id);
      act(() => globalSheetModalEvents.emit(EVENT_NAMES.PRESENT, id));
      expect(mockPresent).toHaveBeenCalledTimes(1);
      act(() => globalSheetModalEvents.emit(EVENT_NAMES.REMOVE, id));
      act(() => globalSheetModalEvents.emit(EVENT_NAMES.PRESENT, id));
      expect(mockPresent).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      globalSheetModalEvents.off(EVENT_NAMES.PRESENTED, presented);
      jest.useRealTimers();
    }
  },
);
