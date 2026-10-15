import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { HistoryFilterMenu } from './HistoryFilterMenu';

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/components2024/Toast', () => ({
  toast: { success: jest.fn() },
}));
jest.mock('@/components/customized/Switch2024', () => ({
  AppSwitch2024: require('react-native').View,
}));
jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: require('react-native').TouchableOpacity,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

it.each([true, false])(
  'toggles the scam filter once from showAll=%s',
  initial => {
    const onValueChange = jest.fn();
    const Harness = () => {
      const [isShowAll, setIsShowAll] = React.useState(initial);
      return (
        <HistoryFilterMenu
          isShowAll={isShowAll}
          setIsShowAll={setIsShowAll}
          handleSwitchShowAll={onValueChange}
        />
      );
    };
    render(<Harness />);
    expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(
      !initial,
    );
    fireEvent.press(screen.getByRole('switch'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(initial);
    expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(
      initial,
    );
    fireEvent.press(screen.getByRole('switch'));
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith(!initial);
  },
);
