import React from 'react';
import { act, render } from '@testing-library/react-native';
import {
  GlobalBottomSheetModal2024,
  removeAllGlobalBottomSheetModals,
} from './GlobalBottomSheetModal';
import { globalSheetModalEvents } from './event';
import { EVENT_NAMES, MODAL_NAMES, type MODAL_ID } from './types';
import { bottomSheetModalSecurityApis } from './security';
import { storeApiScreenshotReport } from '@/components/Screenshot/hooks';

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

it.each(['remove', 'clear-all', 'unmount'] as const)(
  'does not resurrect a pending sheet after %s while approval lookup is resolving',
  async cancellation => {
    mockPresent.mockClear();
    mockClose.mockClear();
    jest.mocked(bottomSheetModalSecurityApis.markAtSensitiveModal).mockClear();
    jest
      .mocked(storeApiScreenshotReport.markIsScreenshotReportFree)
      .mockClear();
    let resolveApproval!: (value: undefined) => void;
    mockGetApproval.mockReturnValueOnce(
      new Promise<undefined>(resolve => {
        resolveApproval = resolve;
      }),
    );
    const presented = jest.fn();
    const id: MODAL_ID = 'WALLETCONNECT_PAIRING_cancel-before-commit';
    globalSheetModalEvents.on(EVENT_NAMES.PRESENTED, presented);
    const view = render(<GlobalBottomSheetModal2024 />);
    try {
      act(() => {
        globalSheetModalEvents.emit(EVENT_NAMES.CREATE, id, {
          name: MODAL_NAMES.WALLETCONNECT_PAIRING,
          preventScreenshotOnModalOpen: true,
          screenshotReportFreeBeforeModalClose: true,
        });
      });
      expect(mockPresent).not.toHaveBeenCalled();
      act(() => {
        if (cancellation === 'remove') {
          globalSheetModalEvents.emit(EVENT_NAMES.REMOVE, id);
        } else if (cancellation === 'clear-all') {
          removeAllGlobalBottomSheetModals();
        } else {
          view.unmount();
        }
      });
      await act(async () => {
        resolveApproval(undefined);
        await Promise.resolve();
      });
      expect(mockPresent).not.toHaveBeenCalled();
      expect(presented).not.toHaveBeenCalled();
      expect(
        bottomSheetModalSecurityApis.markAtSensitiveModal,
      ).not.toHaveBeenCalled();
      expect(
        storeApiScreenshotReport.markIsScreenshotReportFree,
      ).not.toHaveBeenCalled();

      if (cancellation !== 'unmount') {
        const nextId: MODAL_ID = 'WALLETCONNECT_PAIRING_after-cancellation';
        await act(async () => {
          globalSheetModalEvents.emit(EVENT_NAMES.CREATE, nextId, {
            name: MODAL_NAMES.WALLETCONNECT_PAIRING,
          });
          await Promise.resolve();
        });
        expect(mockPresent).toHaveBeenCalledTimes(1);
        expect(presented).toHaveBeenCalledWith(nextId);
      }
    } finally {
      view.unmount();
      globalSheetModalEvents.off(EVENT_NAMES.PRESENTED, presented);
      mockGetApproval.mockReset().mockResolvedValue(undefined);
    }
  },
);

it.each([false, true])(
  'keeps a replacement request when a cancelled lookup resolves (oldFirst=%s)',
  async oldFirst => {
    mockPresent.mockClear();
    jest.mocked(bottomSheetModalSecurityApis.markAtSensitiveModal).mockClear();
    const resolvers: Array<(value: undefined) => void> = [];
    for (let i = 0; i < 2; i++) {
      mockGetApproval.mockReturnValueOnce(
        new Promise<undefined>(resolve => resolvers.push(resolve)),
      );
    }
    const id: MODAL_ID = 'WALLETCONNECT_PAIRING_replacement';
    const view = render(<GlobalBottomSheetModal2024 />);
    try {
      act(() => {
        globalSheetModalEvents.emit(EVENT_NAMES.CREATE, id, {
          name: MODAL_NAMES.WALLETCONNECT_PAIRING,
          preventScreenshotOnModalOpen: true,
        });
        globalSheetModalEvents.emit(EVENT_NAMES.REMOVE, id);
        globalSheetModalEvents.emit(EVENT_NAMES.CREATE, id, {
          name: MODAL_NAMES.WALLETCONNECT_PAIRING,
        });
      });
      for (const index of oldFirst ? [0, 1] : [1, 0]) {
        await act(async () => {
          resolvers[index](undefined);
          await Promise.resolve();
        });
      }
      expect(mockPresent).toHaveBeenCalledTimes(1);
      expect(
        bottomSheetModalSecurityApis.markAtSensitiveModal,
      ).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      mockGetApproval.mockReset().mockResolvedValue(undefined);
    }
  },
);
