import React from 'react';
import { TouchableOpacity } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { getDefaultStore } from 'jotai';

import { QrCodeModal } from './QrCodeModal';
import { dataAtom, visibleAtom } from './useQrCodeModal';

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/core/utils/device', () => ({
  __esModule: true,
  default: { getDeviceWidth: () => 390 },
}));
jest.mock('@/utils/modalGate', () => ({
  MODAL_GATE_IDS: { qrCode: 'qr-code' },
  useRegisterBlockingModal: jest.fn(),
}));
jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('react-native-qrcode-svg', () => () => null);
jest.mock('@/assets2024/icons/common/close-circle.svg', () => () => null);
jest.mock('@/components/Modal/TrackedModal', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    TrackedModal: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement(View, null, children),
  };
});

const store = getDefaultStore();

afterEach(() => {
  act(() => {
    store.set(visibleAtom, false);
    store.set(dataAtom, undefined);
  });
});

it('does not fade the QR while the close press is handled', () => {
  store.set(dataAtom, '0x341a1fbd51825e5a107db54ccb3166deba145479');
  store.set(visibleAtom, true);

  const view = render(<QrCodeModal />);
  const overlay = view.UNSAFE_getByType(TouchableOpacity);

  expect(overlay.props.activeOpacity).toBe(1);
  fireEvent.press(overlay);
  expect(store.get(visibleAtom)).toBe(false);
});

it('keeps the QR content mounted after it becomes invisible', () => {
  store.set(dataAtom, '0x341a1fbd51825e5a107db54ccb3166deba145479');
  store.set(visibleAtom, true);

  const view = render(<QrCodeModal />);
  act(() => {
    store.set(visibleAtom, false);
  });

  expect(view.UNSAFE_getAllByType(TouchableOpacity)).toHaveLength(1);
});

it('renders nothing before the first open', () => {
  const view = render(<QrCodeModal />);
  expect(view.UNSAFE_queryAllByType(TouchableOpacity)).toHaveLength(0);
});
