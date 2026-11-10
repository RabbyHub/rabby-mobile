import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
// eslint-disable-next-line no-restricted-imports -- inspect and drive the native modal boundary.
import { Modal, Pressable, View } from 'react-native';
import Tooltip from 'react-native-walkthrough-tooltip';
import { Text } from '@/components/Typography';
import { Tip } from './Tip';
import {
  getVisibleBlockingModalIds,
  MODAL_GATE_IDS,
  resetModalGateForTests,
} from '@/utils/modalGate';

// Component tests keep Tip, its state, Tooltip and the modal registry real.
jest.mock('@/hooks/theme', () => ({
  useThemeStyles: () => ({ colors: {}, styles: {} }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('./customized/reexports', () => ({
  RNGHPressable: require('react-native').Pressable,
}));
jest.mock('@/core/native/RNHelpers', () => ({
  __esModule: true,
  default: { measureViewRelativeTo: jest.fn() },
}));
jest.mock('@/core/utils/reexports', () => ({
  zCreate: jest.requireActual('zustand').create,
}));

beforeEach(() => {
  jest.useFakeTimers();
  resetModalGateForTests();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  resetModalGateForTests();
});

describe.each(['RNPressable', 'RNGHPressable'] as const)('Tip using %s', as => {
  it.each([undefined, '', ' \n\t'])(
    'does not open empty content (%p), while preserving child actions and layout',
    content => {
      const onPress = jest.fn(({ turnOn }) => turnOn());
      const onChildPress = jest.fn();
      const view = render(
        <Tip
          as={as}
          content={content}
          pressableProps={{
            testID: 'tip-trigger',
            style: { width: 172, flex: 1 },
            onPress,
          }}>
          <Pressable testID="child-action" onPress={onChildPress}>
            <Text>Confirm</Text>
          </Pressable>
        </Tip>,
      );

      fireEvent.press(view.getByTestId('tip-trigger'));
      fireEvent.press(view.getByTestId('child-action'));

      expect(onPress).not.toHaveBeenCalled();
      expect(onChildPress).toHaveBeenCalledTimes(1);
      expect(view.getByTestId('tip-trigger')).toHaveStyle({
        width: 172,
        flex: 1,
      });
      expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
    },
  );
});

it('supports repeated opening and closing with an explicitly undefined isVisible', () => {
  const view = render(
    <Tip content="Gas account details" isVisible={undefined}>
      <Text>Info</Text>
    </Tip>,
  );

  for (let i = 0; i < 3; i++) {
    fireEvent.press(view.getByText('Info'));
    expect(view.UNSAFE_getByType(Modal).props.visible).toBe(true);
    act(() => view.UNSAFE_getByType(Tooltip).props.onClose());
    expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
  }
});

it('closes when content clears and does not reopen when content returns', () => {
  const renderTip = (content?: string) => (
    <Tip content={content}>
      <Text>Info</Text>
    </Tip>
  );
  const view = render(renderTip('Gas details'));
  fireEvent.press(view.getByText('Info'));
  expect(view.UNSAFE_getByType(Modal).props.visible).toBe(true);

  view.rerender(renderTip(undefined));
  expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
  view.rerender(renderTip('Updated gas details'));
  expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
  fireEvent.press(view.getByText('Info'));
  expect(view.UNSAFE_getByType(Modal).props.visible).toBe(true);
});

it('blocks empty controlled content and preserves normal controlled menus', () => {
  const renderTip = (content?: React.ReactElement, isVisible = true) => (
    <Tip content={content} isVisible={isVisible} noPressable>
      <View testID="anchor" />
    </Tip>
  );
  const view = render(renderTip(undefined));
  expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
  view.rerender(renderTip(<Text>Menu action</Text>));
  expect(view.UNSAFE_getByType(Modal).props.visible).toBe(true);
  view.rerender(renderTip(<Text>Menu action</Text>, false));
  expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
});

it('preserves an explicitly disabled trigger with nonempty content', () => {
  const view = render(
    <Tip content="Details" pressableProps={{ disabled: true }}>
      <Text>Info</Text>
    </Tip>,
  );
  fireEvent.press(view.getByText('Info'));
  expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
});

it('keeps the modal mounted until its native dismiss callback when content clears', () => {
  const onModalDismiss = jest.fn();
  const renderTip = (content?: string) => (
    <Tip
      content={content}
      isVisible
      modalGateId={MODAL_GATE_IDS.gasAccountHeaderMenu}
      onModalDismiss={onModalDismiss}>
      <View />
    </Tip>
  );
  const view = render(renderTip('Gas details'));
  const modal = view.UNSAFE_getByType(Modal);
  expect(getVisibleBlockingModalIds()).toEqual([
    MODAL_GATE_IDS.gasAccountHeaderMenu,
  ]);

  view.rerender(renderTip(undefined));
  expect(view.UNSAFE_getByType(Modal)).toBe(modal);
  expect(modal.props.visible).toBe(false);
  expect(getVisibleBlockingModalIds()).toEqual([
    MODAL_GATE_IDS.gasAccountHeaderMenu,
  ]);
  act(() => modal.props.onDismiss());
  expect(onModalDismiss).toHaveBeenCalledTimes(1);
  expect(getVisibleBlockingModalIds()).toEqual([]);
});
