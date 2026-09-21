import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/assets2024/icons/perps/PerpsProCloseAllWarning.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Modal/TrackedModal', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    TrackedModal: ({ children, visible, ...props }: any) =>
      visible
        ? ReactModule.createElement(
            View,
            { ...props, testID: 'tracked-modal' },
            children,
          )
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
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(
      <PerpsProCancelConfirmationModal
        confirmation={
          {
            message: 'Are you sure you want to cancel all orders?',
            title: 'Cancel All Orders',
          } as any
        }
        onCancel={onCancel}
        onConfirm={onConfirm}
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
      color: 'neutral-body',
      fontSize: 16,
      lineHeight: 20,
      textAlign: 'left',
    });
    const buttons = screen.getAllByRole('button');
    for (const button of buttons) {
      expect(StyleSheet.flatten(button.props.style)).toMatchObject({
        height: 40,
        borderRadius: 10,
      });
    }
    fireEvent.press(screen.getByText('global.cancel'));
    fireEvent.press(screen.getByText('global.confirm'));
    fireEvent(screen.getByTestId('tracked-modal'), 'requestClose');
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
