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
    perpsProCancelConfirmation: 'perps-pro-cancel-confirmation',
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PerpsProCancelConfirmationModal } from './PerpsProCancelConfirmationModal';

describe('PerpsProCancelConfirmationModal', () => {
  it('matches the approved content spacing and copy treatment', () => {
    render(
      <PerpsProCancelConfirmationModal
        confirmation={
          {
            message: 'Are you sure you want to cancel all orders?',
            title: 'Cancel All Orders',
          } as any
        }
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-cancel-confirmation-content').props.style,
      ),
    ).toMatchObject({ gap: 16, width: '100%' });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-cancel-confirmation-copy').props.style,
      ),
    ).toMatchObject({ gap: 8, paddingBottom: 8, width: '100%' });
    expect(
      StyleSheet.flatten(screen.getByText('Cancel All Orders').props.style),
    ).toMatchObject({
      color: 'neutral-title-1',
      textAlign: 'center',
    });
    expect(
      StyleSheet.flatten(
        screen.getByText('Are you sure you want to cancel all orders?').props
          .style,
      ),
    ).toMatchObject({
      color: 'neutral-title-1',
      textAlign: 'left',
    });
  });
});
