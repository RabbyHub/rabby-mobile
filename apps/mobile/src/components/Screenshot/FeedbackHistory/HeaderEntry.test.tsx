import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

import { openapi } from '@/core/request';
import { FeedbackHistoryHeaderEntry } from './HeaderEntry';
import { toggleFeedbackHistoryVisible } from '../hooks';

// Keep RNGH's TouchableOpacity -> GenericTouchable -> Animated.View layout.
// Only its unavailable native bridge is mocked; this is not a native hit-test.
jest.mock(
  'react-native-gesture-handler/lib/commonjs/RNGestureHandlerModule',
  () => require('react-native-gesture-handler/lib/commonjs/mocks/mocks'),
);
jest.mock(
  'react-native-gesture-handler/lib/commonjs/specs/RNGestureHandlerButtonNativeComponent',
  () => ({
    __esModule: true,
    default: require('react-native').requireNativeComponent(
      'RNGestureHandlerButton',
    ),
  }),
);
jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: jest.requireActual(
    'react-native-gesture-handler/lib/commonjs/components/touchables/TouchableOpacity',
  ).default,
}));

jest.mock('../hooks', () => ({ toggleFeedbackHistoryVisible: jest.fn() }));
jest.mock('@/core/apis/device', () => ({
  makeDeviceUUID: () => ({ deviceUUID: 'feedback-test-device' }),
}));
jest.mock('@/core/request', () => ({
  openapi: { getClientFeedbackUnread: jest.fn() },
}));
jest.mock('@/components2024/Button', () => ({ Button: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/core/native/utils', () => ({ IS_IOS: true, IS_ANDROID: false }));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({
    getStyle,
  }: {
    getStyle: { getStyles: (context: object) => object };
  }) => ({
    // Evaluate the production style factory, including createGetStyles2024.
    styles: getStyle.getStyles({
      colors2024: {
        'neutral-title-1': '#192945',
        'red-default': '#ff453a',
      },
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    }),
  }),
}));
jest.mock('@/assets/icons/feedback/chat-cc.svg', () => {
  const { View } = require('react-native');
  return (props: object) => <View {...props} testID="feedback-chat-icon" />;
});

const getUnread = jest.mocked(openapi.getClientFeedbackUnread);

function getUnreadDots() {
  return screen.UNSAFE_getByType(TouchableOpacity).findAll(node => {
    const style = StyleSheet.flatten(node.props.style);
    return (
      typeof node.type === 'string' &&
      style?.position === 'absolute' &&
      style?.width === 4 &&
      style?.height === 4
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  getUnread.mockResolvedValue({ unread_count: 3, status: null });
});

it('centers the fixed-size icon in the full-height RNGH content view', async () => {
  render(<FeedbackHistoryHeaderEntry style={{ marginRight: 12 }} />);
  await waitFor(() => expect(getUnreadDots()).toHaveLength(1));

  const touchable = screen.UNSAFE_getByType(TouchableOpacity);
  expect(touchable.props.activeOpacity).toBe(1);
  expect(StyleSheet.flatten(touchable.props.style)).toMatchObject({
    height: '100%',
    justifyContent: 'center',
    marginRight: 12,
  });
  // Verify the style reaches the real RNGH inner native-view boundary, not
  // merely the outer component's props. Yoga positioning still needs a device.
  const contentViews = touchable.findAll(
    node =>
      typeof node.type === 'string' &&
      StyleSheet.flatten(node.props.style)?.height === '100%',
  );
  expect(contentViews).toHaveLength(1);
  expect(StyleSheet.flatten(contentViews[0].props.style)).toMatchObject({
    justifyContent: 'center',
    marginRight: 12,
  });
  expect(screen.getByTestId('feedback-chat-icon')).toHaveStyle({
    width: 20,
    height: 20,
  });
  expect(StyleSheet.flatten(getUnreadDots()[0].props.style)).toMatchObject({
    position: 'absolute',
    top: -2,
    right: -2,
  });
});

it('opens history once and clears the visible unread dot through useRequest', async () => {
  render(<FeedbackHistoryHeaderEntry />);
  await waitFor(() => expect(getUnreadDots()).toHaveLength(1));
  expect(getUnread).toHaveBeenCalledWith({ device_id: 'feedback-test-device' });

  fireEvent.press(screen.getByTestId('feedback-chat-icon'));

  expect(toggleFeedbackHistoryVisible).toHaveBeenCalledTimes(1);
  expect(toggleFeedbackHistoryVisible).toHaveBeenCalledWith(true);
  await waitFor(() => expect(getUnreadDots()).toHaveLength(0));
  expect(screen.getByTestId('feedback-chat-icon')).toBeOnTheScreen();
  expect(getUnread).toHaveBeenCalledTimes(1);
});

it('remains clickable when the unread count is zero', async () => {
  getUnread.mockResolvedValue({ unread_count: 0, status: null });
  render(<FeedbackHistoryHeaderEntry />);
  await waitFor(() => expect(getUnread).toHaveBeenCalledTimes(1));

  expect(getUnreadDots()).toHaveLength(0);
  fireEvent.press(screen.getByTestId('feedback-chat-icon'));
  expect(toggleFeedbackHistoryVisible).toHaveBeenCalledWith(true);
  expect(getUnreadDots()).toHaveLength(0);
});

it('opens history before unread data has arrived', () => {
  getUnread.mockReturnValue(new Promise(() => undefined));
  render(<FeedbackHistoryHeaderEntry />);

  expect(getUnreadDots()).toHaveLength(0);
  fireEvent.press(screen.getByTestId('feedback-chat-icon'));
  expect(toggleFeedbackHistoryVisible).toHaveBeenCalledTimes(1);
  expect(toggleFeedbackHistoryVisible).toHaveBeenCalledWith(true);
  expect(getUnreadDots()).toHaveLength(0);
});
