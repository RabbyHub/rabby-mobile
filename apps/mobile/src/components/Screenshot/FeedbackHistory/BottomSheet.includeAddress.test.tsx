import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { openapi } from '@/core/request';
import { getScreenshotFeedbackExtraSafely } from '../hooks';
import { FeedbackHistoryBottomSheet } from './BottomSheet';

// Component coverage of the reply composer's address checkbox. The sheet host,
// keyboard, media pickers and the network are mocked process boundaries; the
// payload rules themselves are covered in ../utils.test.ts.
const CHECKBOX_TEST_ID = 'feedback-chat-include-address';

// Hook results must keep stable identities, like the real hooks, or the
// sheet's open/close effect re-runs on every render.
const mockHistoryVisible = {
  isShowHistory: true,
  feedbackHistoryRefreshKey: 0,
  toggleFeedbackHistoryVisible: jest.fn(),
};
const mockSheetModal = {
  sheetModalRef: { current: null },
  toggleShowSheetModal: jest.fn(),
};

// The remembered choice is a small store here; its persistence is covered with
// the real hook in ../SubmitFeedback/ShareAddressCheckbox.test.tsx.
jest.mock('../hooks', () => {
  const includeAddressStore = require('zustand').create(() => ({
    includeAddress: true,
  }));
  return {
    includeAddressStore,
    getScreenshotFeedbackExtraSafely: jest.fn(async () => ({ app: 'extra' })),
    useFeedbackHistoryVisible: () => mockHistoryVisible,
    useScreenshotFeedbackIncludeAddress: () => ({
      includeAddress: includeAddressStore(
        (s: { includeAddress: boolean }) => s.includeAddress,
      ),
      setIncludeAddress: (includeAddress: boolean) =>
        includeAddressStore.setState({ includeAddress }),
    }),
  };
});
jest.mock('./MediaPreview', () => ({ FeedbackMediaPreview: () => null }));
jest.mock('@/core/request', () => ({
  openapi: {
    getClientFeedbackMessages: jest.fn(async () => ({
      messages: [],
      total_count: 0,
    })),
    getClientFeedbackUnread: jest.fn(async () => ({ unread_count: 0 })),
    postClientFeedbackMessage: jest.fn(async () => ({})),
    uploadClientFeedback: jest.fn(),
  },
}));
jest.mock('@/core/apis/device', () => ({
  makeDeviceUUID: () => ({ deviceUUID: 'device-1' }),
}));
jest.mock('@/components2024/Toast', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock('@/components2024/Button', () => {
  const { Text, TouchableOpacity } = require('react-native');
  const { createElement } = require('react');
  return {
    Button: ({ title, onPress, disabled }: any) =>
      createElement(
        TouchableOpacity,
        { testID: 'reply-submit', onPress, disabled },
        createElement(Text, null, title),
      ),
  };
});
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/hooks/useSheetModal', () => ({
  useSheetModal: () => mockSheetModal,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (ctx: object) => object }) => {
    const colors2024 = new Proxy({}, { get: () => '#000000' });
    const ctx = {
      colors2024,
      isLight: true,
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    return { styles: getStyle(ctx), colors2024, isLight: true };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/constant/theme', () => ({
  ThemeColors2024: { light: { 'neutral-bg-1': '#ffffff' } },
}));
jest.mock('@/components/Typography', () => {
  const { Text, TextInput } = require('react-native');
  return { Text, TextInput };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: require('react-native').TouchableOpacity,
}));
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = require('react-native');
  return {
    KeyboardProvider: ({ children }: { children: React.ReactNode }) => children,
    KeyboardAwareScrollView: ScrollView,
  };
});
jest.mock('react-native-compressor', () => ({
  getFileSize: jest.fn(),
  Image: { compress: jest.fn() },
  Video: { compress: jest.fn(), cancelCompression: jest.fn() },
}));
jest.mock('react-native-fast-image', () => require('react-native').Image);
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('react-native-video', () => () => null);
jest.mock('../../AutoLockView', () => require('react-native').View);
jest.mock('../../customized/BottomSheet', () => {
  const { forwardRef } = require('react');
  return {
    AppBottomSheetModal: forwardRef(
      ({ children }: { children: React.ReactNode }, _ref: unknown) => children,
    ),
  };
});
jest.mock('../../customized/BottomSheetHandle', () => ({
  BottomSheetHandlableView: require('react-native').View,
}));
jest.mock('@/assets/icons/feedback/close.svg', () => () => null);
jest.mock('@/assets/icons/feedback/close-dark.svg', () => () => null);
jest.mock('@/assets/icons/feedback/rabby-avatar.svg', () => () => null);
jest.mock('@/assets/icons/feedback/rabby-avatar-dark.svg', () => () => null);
jest.mock('@/assets/icons/feedback/user-avatar.svg', () => () => null);
jest.mock('@/assets/icons/feedback/user-avatar-dark.svg', () => () => null);
jest.mock(
  '@/assets2024/icons/common/checkbox-round-checked-cc.svg',
  () => () => null,
);
jest.mock(
  '@/assets2024/icons/common/checkbox-round-empty-cc.svg',
  () => () => null,
);

const getExtra = jest.mocked(getScreenshotFeedbackExtraSafely);
const postFeedback = jest.mocked(openapi.postClientFeedbackMessage);
const rememberedChoice = () =>
  (
    jest.requireMock('../hooks') as {
      includeAddressStore: {
        getState: () => { includeAddress: boolean };
        setState: (state: { includeAddress: boolean }) => void;
      };
    }
  ).includeAddressStore;

// The sheet schedules scroll-to-bottom work (setTimeout + rAF) after loads and
// sends. Let it run before the test ends so no timer outlives the environment.
const SCROLL_TIMERS_DRAIN_MS = 400;
let unmountChat: (() => void) | null = null;

async function renderChat() {
  const view = render(<FeedbackHistoryBottomSheet />);
  unmountChat = view.unmount;
  await waitFor(() =>
    expect(openapi.getClientFeedbackMessages).toHaveBeenCalled(),
  );
  const checkbox = () => view.getByTestId(CHECKBOX_TEST_ID);
  const isChecked = () => checkbox().props.accessibilityState?.checked;
  const sendReply = async (text: string) => {
    fireEvent.changeText(
      view.getByPlaceholderText(
        'component.feedbackHistoryModal.replyPlaceholder',
      ),
      text,
    );
    await act(async () => {
      fireEvent.press(view.getByTestId('reply-submit'));
    });
    await waitFor(() => expect(postFeedback).toHaveBeenCalled());
  };
  return { view, checkbox, isChecked, sendReply };
}

describe('FeedbackHistoryBottomSheet address sharing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rememberedChoice().setState({ includeAddress: true });
  });

  afterEach(async () => {
    unmountChat?.();
    unmountChat = null;
    await act(
      () =>
        new Promise<void>(resolve =>
          setTimeout(resolve, SCROLL_TIMERS_DRAIN_MS),
        ),
    );
  });

  it('sends a reply with addresses by default', async () => {
    const { view, isChecked, sendReply } = await renderChat();

    expect(
      view.getByText('component.screenshotModal.includeAddress'),
    ).toBeTruthy();
    expect(isChecked()).toBe(true);

    await sendReply('still broken');

    expect(getExtra).toHaveBeenCalledWith({ includeAddress: true });
    expect(postFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'still broken',
        extra: { app: 'extra' },
      }),
    );
  });

  it('sends without addresses once unchecked and keeps it unchecked after sending', async () => {
    const { checkbox, isChecked, sendReply } = await renderChat();

    fireEvent.press(checkbox());
    expect(isChecked()).toBe(false);
    expect(rememberedChoice().getState().includeAddress).toBe(false);

    await sendReply('still broken');

    expect(getExtra).toHaveBeenCalledWith({ includeAddress: false });
    expect(isChecked()).toBe(false);
  });

  it('opens with the remembered choice', async () => {
    rememberedChoice().setState({ includeAddress: false });
    const { isChecked, sendReply } = await renderChat();

    expect(isChecked()).toBe(false);

    await sendReply('still broken');

    expect(getExtra).toHaveBeenCalledWith({ includeAddress: false });
  });
});
