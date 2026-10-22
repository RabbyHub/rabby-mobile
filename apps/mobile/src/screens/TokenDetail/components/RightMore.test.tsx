import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Platform } from 'react-native';

const mockTogglePinned = jest.fn();
const mockRemoveToken = jest.fn();
let mockTipProps: Record<string, any> = {};

jest.mock('@/hooks/useTokenSettings', () => ({
  useIsUserTokenPinned: () => false,
  toggleUserTokenPinned: (...args: unknown[]) => mockTogglePinned(...args),
}));
jest.mock('@/components2024/RemoveTokenConfirmPopup', () => ({
  createRemoveTokenConfirmPopup: (...args: unknown[]) =>
    mockRemoveToken(...args),
}));
jest.mock('@/components/Tip', () => ({
  Tip: (props: any) => {
    const { children, content, isVisible } = props;
    mockTipProps = props;
    const { View } = require('react-native');
    return (
      <>
        {children}
        {isVisible ? <View testID="token-header-menu">{content}</View> : null}
      </>
    );
  },
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_t, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, isLight: true }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/assets/icons/home/more-cc.svg', () => {
  const { View } = require('react-native');
  return (props: object) => <View testID="token-header-more" {...props} />;
});
jest.mock('@/assets2024/icons/browser/favorite-cc.svg', () => () => null);
jest.mock(
  '@/assets2024/icons/common/token-header-remove-arrow.svg',
  () => () => null,
);
jest.mock('@/utils/modalGate', () => ({
  MODAL_GATE_IDS: { tokenDetailHeaderMenu: 'token-detail-header-menu' },
}));

const { RightMore } = require('./RightMore') as typeof import('./RightMore');

const token = {
  id: 'eth',
  chain: 'eth',
} as never;

const originalOS = Platform.OS;

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'ios',
  });
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalOS,
  });
});

beforeEach(() => jest.clearAllMocks());

describe('RightMore header actions', () => {
  it('keeps favorite and remove actions wired', async () => {
    const refreshTags = jest.fn();
    render(<RightMore token={token} refreshTags={refreshTags} />);

    fireEvent.press(screen.getByTestId('token-header-more'));
    fireEvent.press(screen.getByText('page.tokenDetail.action.favorite'));
    expect(mockTogglePinned).toHaveBeenCalledWith(token);
    await waitFor(() => expect(refreshTags).toHaveBeenCalled());

    fireEvent.press(screen.getByTestId('token-header-more'));
    fireEvent.press(screen.getByText('page.singleHome.tokenActions.remove'));
    expect(mockRemoveToken).not.toHaveBeenCalled();
    act(() => mockTipProps.onModalDismiss());
    expect(mockRemoveToken).toHaveBeenCalledWith(token);
  });

  it('opens the remove confirmation only after the header menu modal dismisses', () => {
    render(<RightMore token={token} refreshTags={jest.fn()} />);

    fireEvent.press(screen.getByTestId('token-header-more'));
    fireEvent.press(screen.getByText('page.singleHome.tokenActions.remove'));

    expect(mockRemoveToken).not.toHaveBeenCalled();

    act(() => mockTipProps.onModalDismiss());
    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
    expect(mockRemoveToken).toHaveBeenCalledWith(token);

    act(() => mockTipProps.onModalDismiss());
    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
  });
});
