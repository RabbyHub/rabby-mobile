import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { RightMore } from './RightMore';

jest.mock(
  'react-native-gesture-handler/lib/commonjs/RNGestureHandlerModule',
  () => require('react-native-gesture-handler/lib/commonjs/mocks/mocks'),
);
jest.mock(
  'react-native-gesture-handler/lib/commonjs/specs/RNGestureHandlerButtonNativeComponent',
  () => ({
    __esModule: true,
    default: require('react-native').requireNativeComponent(
      'RNGestureHandlerButton',
    ),
  }),
);
jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: jest.requireActual(
    'react-native-gesture-handler/lib/commonjs/components/touchables/TouchableOpacity',
  ).default,
}));

const mockTogglePinned = jest.fn();
const mockRemoveToken = jest.fn();

jest.mock('@/hooks/useTokenSettings', () => ({
  useIsUserTokenPinned: () => false,
  toggleUserTokenPinned: (...args: unknown[]) => mockTogglePinned(...args),
}));
jest.mock('@/components2024/RemoveTokenConfirmPopup', () => ({
  createRemoveTokenConfirmPopup: (...args: unknown[]) =>
    mockRemoveToken(...args),
}));
jest.mock('@/components/Tip', () => ({
  Tip: ({
    children,
    content,
    isVisible,
  }: React.PropsWithChildren<{
    content: React.ReactNode;
    isVisible: boolean;
  }>) => {
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

const token = {
  id: 'eth',
  chain: 'eth',
} as never;

describe('RightMore native header trigger', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the RNGH host so the Fabric native-stack header receives presses', () => {
    render(<RightMore token={token} refreshTags={jest.fn()} />);

    expect(screen.UNSAFE_getByType(CustomTouchableOpacity).props.as).toBe(
      'RNGHTouchableOpacity',
    );
    expect(screen.queryByTestId('token-header-menu')).toBeNull();

    fireEvent.press(screen.getByTestId('token-header-more'));
    expect(screen.getByTestId('token-header-menu')).toBeOnTheScreen();
  });

  it('keeps the favorite and remove actions wired', async () => {
    const refreshTags = jest.fn();
    render(<RightMore token={token} refreshTags={refreshTags} />);

    fireEvent.press(screen.getByTestId('token-header-more'));
    fireEvent.press(screen.getByText('page.tokenDetail.action.favorite'));
    expect(mockTogglePinned).toHaveBeenCalledWith(token);
    await waitFor(() => expect(refreshTags).toHaveBeenCalled());

    fireEvent.press(screen.getByTestId('token-header-more'));
    fireEvent.press(screen.getByText('page.singleHome.tokenActions.remove'));
    expect(mockRemoveToken).toHaveBeenCalledWith(token);
  });
});
