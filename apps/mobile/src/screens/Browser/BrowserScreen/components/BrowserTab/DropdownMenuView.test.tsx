import React from 'react';
import { render } from '@testing-library/react-native';
import { processColor, View } from 'react-native';
import type { ColorSchemeName } from 'react-native';
import { DropdownMenuView } from './DropdownMenuView';

// modalGate pulls the shared reexports, which touch the haptics native module.
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('react-native-gesture-handler', () => ({
  Pressable: jest.requireActual('react-native').Pressable,
}));

jest.mock('@/core/native/utils', () => ({
  IS_ANDROID: true,
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// packages/zeego resolves react and react-native from the repo root, which Jest
// loads as separate copies. Point them at the app copies, as Metro does.
jest.mock('../../../../../../../../node_modules/react', () =>
  jest.requireActual('react'),
);
jest.mock('../../../../../../../../node_modules/react-native', () =>
  jest.requireActual('react-native'),
);

// Jest resolves the iOS platform file by default; use zeego's real Android menu.
jest.mock('@rabby-wallet/zeego/dropdown-menu', () =>
  jest
    .requireActual(
      '@rabby-wallet/zeego/src/menu/create-android-menu/index.android',
    )
    .createAndroidMenu('DropdownMenu'),
);

jest.mock('@rabby-wallet/react-native-menu', () => {
  const { View: MockView } = jest.requireActual('react-native');
  return {
    MenuView: jest.fn(({ children }: React.PropsWithChildren) => (
      <MockView>{children}</MockView>
    )),
  };
});

const mockUseColorScheme = jest.requireMock(
  'react-native/Libraries/Utilities/useColorScheme',
).default as jest.Mock<ColorSchemeName>;
const { MenuView: mockMenuView } = jest.requireMock(
  '@rabby-wallet/react-native-menu',
);

type NativeMenuProps = {
  themeVariant: string;
  actions: { id: string; titleColor?: string }[];
};

function renderMenu() {
  render(
    <DropdownMenuView
      menuConfig={{
        menuActions: [
          { key: 'hostname', title: 'app.example.com', disabled: true },
          { key: 'refresh', title: 'Refresh', onSelect: jest.fn() },
          { key: 'disconnect', title: 'Disconnect', onSelect: jest.fn() },
        ],
      }}>
      <View />
    </DropdownMenuView>,
  );

  const calls = (mockMenuView as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as NativeMenuProps;
}

// Component contract only: the native PopupMenu and Android resources are mocked.
describe('DropdownMenuView on Android', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a valid dark title color with the light popup theme', () => {
    mockUseColorScheme.mockReturnValue('light');

    const props = renderMenu();

    expect(props.themeVariant).toBe('light');
    expect(props.actions).toHaveLength(3);
    // An unset color lets the native item inherit `android:textColor`, which
    // can resolve to white on this light popup.
    props.actions.forEach(action => {
      expect(processColor(action.titleColor)).toBe(processColor('black'));
    });
  });

  it('sends a white title color with the dark popup theme', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const props = renderMenu();

    expect(props.themeVariant).toBe('dark');
    props.actions.forEach(action => {
      expect(processColor(action.titleColor)).toBe(processColor('white'));
    });
  });
});
