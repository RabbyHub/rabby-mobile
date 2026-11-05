import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import NativeToast from 'react-native-root-toast';
import { toast, toastWithDotAnimation } from './index';

jest.mock('react-native-root-toast', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn(), positions: { TOP: 20 } },
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => ({
  getTheme2024: ({ getStyle }: any) => getStyle.getStyles({ colors2024: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyles: unknown) => ({ getStyles }),
}));
jest.mock('@/constant/theme', () => ({
  ThemeColors2024: {
    light: { 'neutral-black': '#000', 'neutral-InvertHighlight': '#fff' },
  },
}));
jest.mock('@/hooks/makeThemeIcon', () => ({
  makeThemeIcon2024FromCC: (Icon: unknown) => Icon,
}));
jest.mock('@/assets/icons/common', () => ({
  RcIconInfoCC: () => null,
  IconTick: () => null,
  IconToastSuccess: () => null,
}));
jest.mock('@/assets2024/icons/common/cancel.svg', () => () => null);
jest.mock('@/components/Approval/components/Popup/Dots', () => ({
  Dots: () => null,
}));
jest.mock('@/core/native/utils', () => ({ IS_IOS: false }));

// Component layout contract, not a Yoga/native text measurement simulation.
describe('toast message layout', () => {
  it.each([toast.show, toast.error, toastWithDotAnimation])(
    'allows a long message to wrap beside the icon/dots without a percentage height',
    show => {
      const message = 'The token on this chain is not supported';
      show(message);
      const [node] = jest.mocked(NativeToast.show).mock.calls.slice(-1)[0];
      const view = render(node as React.ReactElement);
      expect(
        StyleSheet.flatten(view.getByText(message).props.style),
      ).toMatchObject({
        flexShrink: 1,
        fontSize: 15,
        color: '#fff',
      });
      const container = view.UNSAFE_getByType(View);
      expect(StyleSheet.flatten(container.props.style)).not.toHaveProperty(
        'maxHeight',
      );
    },
  );

  it('keeps short messages and caller positioning/dismissal options intact', () => {
    const onHidden = jest.fn();
    toast.success('Copied', { position: 0, onHidden, duration: 4000 });
    const [, options] = jest.mocked(NativeToast.show).mock.calls.slice(-1)[0];
    expect(options).toMatchObject({ position: 0, onHidden, duration: 4000 });
  });
});
