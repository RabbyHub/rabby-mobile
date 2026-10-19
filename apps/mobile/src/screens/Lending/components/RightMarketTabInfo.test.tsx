import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import RightMarketTabInfo from './RightMarketTabInfo';
import { createGlobalBottomSheetModal2024 } from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => ({
    styles: getStyle({ colors2024: {} }),
    colors2024: {},
  }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('../hooks/useMode', () => ({
  useMode: () => ({
    isInIsolationMode: false,
    emodeEnabled: true,
    currentEmode: { label: 'USDe Stablecoins' },
    eModes: {},
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: jest.fn(),
  removeGlobalBottomSheetModal2024: jest.fn(),
}));
jest.mock('./IsolatedTag', () => () => null);
jest.mock('@/assets2024/icons/lending/lighting.svg', () => () => null);
jest.mock('@/assets2024/icons/lending/setting.svg', () => () => null);
jest.mock('@/assets2024/icons/lending/lighting-cc.svg', () => () => null);
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('@react-native-masked-view/masked-view', () => {
  const NativeView = require('react-native').View;
  return (props: any) => <NativeView {...props} />;
});

// Native scroll/re-attachment rendering must still be checked on Android;
// this only protects the selected layer mode and the existing action/design.
it('uses the software mask while preserving the e-mode label and action', () => {
  const view = render(<RightMarketTabInfo />);
  const mask = view.UNSAFE_getByType(MaskedView);
  expect(mask.props.androidRenderingMode).toBe('software');
  expect(mask.props.maskElement.props.children).toBe('USDe Stablecoins');
  expect(view.getByText('USDe Stablecoins')).toBeTruthy();
  fireEvent.press(view.getByText('USDe Stablecoins'));
  expect(createGlobalBottomSheetModal2024).toHaveBeenCalledWith(
    expect.objectContaining({ name: MODAL_NAMES.DISABLE_EMODE_OVERVIEW }),
  );
});

it('retains the existing iOS fix: native frame owns padding and reserves the full badge height', () => {
  const view = render(<RightMarketTabInfo />);
  const styles = view
    .UNSAFE_getAllByType(View)
    .map(node => StyleSheet.flatten(node.props.style));
  expect(styles).toContainEqual(
    expect.objectContaining({ height: 32, padding: 1, overflow: 'hidden' }),
  );
  expect(styles).toContainEqual(expect.objectContaining({ minHeight: 32 }));
  const background = styles.find(style => style?.position === 'absolute');
  expect(background).toMatchObject({ top: 0, right: 0, bottom: 0, left: 0 });
  expect(background).not.toHaveProperty('padding');
  expect(background).not.toHaveProperty('borderWidth');
});
