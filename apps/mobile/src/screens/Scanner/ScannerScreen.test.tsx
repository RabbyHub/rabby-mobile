import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Provider } from 'jotai';
import { ScannerScreen, useScanner } from './ScannerScreen';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';

const mockNavigation = {
  goBack: jest.fn(),
  dispatch: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: {} }),
}));
jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => mockNavigation,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/QRCodeScanner/QRCodeScanner', () => ({
  QRCodeScanner: () => null,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

function Result() {
  const { text } = useScanner();
  return <Text testID="result">{text || 'empty'}</Text>;
}

it('ignores empty frames and consumes only one result while leaving the scanner', () => {
  render(
    <Provider>
      <ScannerScreen />
      <Result />
    </Provider>,
  );
  const onCodeScanned =
    screen.UNSAFE_getByType(QRCodeScanner).props.onCodeScanned;
  act(() => {
    onCodeScanned([]);
    onCodeScanned([{ value: undefined }]);
  });
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(screen.getByTestId('result').props.children).toBe('empty');
  act(() => {
    onCodeScanned([{ value: undefined }, { value: 'test-public-result' }]);
    onCodeScanned([{ value: 'test-public-result' }]);
    onCodeScanned([{ value: 'another-public-result' }]);
  });
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('result').props.children).toBe(
    'test-public-result',
  );
});
