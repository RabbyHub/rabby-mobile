import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
// eslint-disable-next-line no-restricted-imports -- inspect the native modal boundary.
import { Modal, Pressable, View } from 'react-native';
import { Text } from '@/components/Typography';
import { hasTipContent, Tip } from './Tip';

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

const modalVisible = (view: ReturnType<typeof render>) =>
  view.UNSAFE_getByType(Modal).props.visible;

describe('hasTipContent', () => {
  it('treats missing and blank content as no content', () => {
    expect(hasTipContent(undefined)).toBe(false);
    expect(hasTipContent('')).toBe(false);
    expect(hasTipContent(' \n')).toBe(false);
    expect(hasTipContent('Details')).toBe(true);
    expect(hasTipContent(<Text>Details</Text>)).toBe(true);
  });
});

// Swap, the sign footer and other screens wrap a button in
// `<Tip content={cond ? text : undefined}>`. A tap on the disabled button
// used to open an empty tooltip: an invisible Modal that froze the screen.
describe.each(['RNPressable', 'RNGHPressable'] as const)('Tip as %s', as => {
  it.each([undefined, '', '  '])(
    'does not open with empty content (%p) and lets taps reach the children',
    content => {
      const onChildPress = jest.fn();
      const view = render(
        <Tip as={as} content={content}>
          <Pressable testID="child" onPress={onChildPress}>
            <Text>Confirm</Text>
          </Pressable>
        </Tip>,
      );

      fireEvent.press(view.getByText('Confirm'));

      expect(modalVisible(view)).toBe(false);
      expect(onChildPress).toHaveBeenCalledTimes(1);
    },
  );

  it('still opens when there is content', () => {
    const view = render(
      <Tip as={as} content="Not supported">
        <Text>Info</Text>
      </Tip>,
    );

    fireEvent.press(view.getByText('Info'));

    expect(modalVisible(view)).toBe(true);
  });
});

it('closes when its content becomes empty and stays closed', () => {
  const renderTip = (content?: string) => (
    <Tip content={content}>
      <Text>Info</Text>
    </Tip>
  );
  const view = render(renderTip('Details'));
  fireEvent.press(view.getByText('Info'));
  expect(modalVisible(view)).toBe(true);

  view.rerender(renderTip(undefined));
  expect(modalVisible(view)).toBe(false);

  view.rerender(renderTip('Details'));
  expect(modalVisible(view)).toBe(false);
});

it('never shows a controlled Tip without content', () => {
  const view = render(
    <Tip content={undefined} isVisible noPressable>
      <View />
    </Tip>,
  );

  expect(modalVisible(view)).toBe(false);
});
