import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/assets2024/icons/common/warning-circle-cc.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Modal/TrackedModal', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    TrackedModal: ({ children, visible }: any) =>
      visible
        ? ReactModule.createElement(View, { testID: 'tracked-modal' }, children)
        : null,
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ disabled, loading, onPress, testID, title }: any) =>
      ReactModule.createElement(
        Pressable,
        {
          accessibilityState: { busy: loading, disabled },
          disabled,
          onPress,
          testID,
        },
        ReactModule.createElement(Text, null, loading ? 'loading' : title),
      ),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@/utils/modalGate', () => ({
  MODAL_GATE_IDS: {
    perpsProCloseAllConfirmation: 'perps-pro-close-all-confirmation',
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.positions.closeAllConfirmMessage':
          'This will close all your positions and cancel their associated TP/SL orders.',
        'page.perps.pro.positions.closeAllConfirmTitle':
          'Confirm Close All Positions',
      }[key] ?? key),
  }),
}));

import { PerpsProCloseAllConfirmationModal } from './PerpsProCloseAllConfirmationModal';

describe('PerpsProCloseAllConfirmationModal', () => {
  it('uses the approved 297px warning-card shell and exact product copy', () => {
    render(
      <PerpsProCloseAllConfirmationModal
        confirmation={{} as any}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        pending={false}
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-close-all-confirmation-content').props
          .style,
      ),
    ).toMatchObject({ gap: 16, width: '100%' });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-close-all-confirmation-copy').props.style,
      ),
    ).toMatchObject({ gap: 8, paddingBottom: 8, width: '100%' });
    expect(screen.getByText('Confirm Close All Positions')).toBeTruthy();
    expect(
      screen.getByText(
        'This will close all your positions and cancel their associated TP/SL orders.',
      ),
    ).toBeTruthy();
  });

  it('keeps the confirmation visible and exposes the shared button loading state', () => {
    render(
      <PerpsProCloseAllConfirmationModal
        confirmation={{} as any}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        pending
      />,
    );

    expect(screen.getByTestId('tracked-modal')).toBeTruthy();
    expect(
      screen.getByTestId('perps-pro-close-all-confirm').props
        .accessibilityState,
    ).toEqual({ busy: true, disabled: true });
    expect(screen.getByText('loading')).toBeTruthy();
  });
});
