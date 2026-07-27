import React from 'react';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import type { MenuConfig } from '@/components2024/ContextMenuView/ContextMenuView';

const mockRemoveAccount = jest.fn();
const mockUseDeleteAccountModal = jest.fn(() => mockRemoveAccount);
const mockToastSuccess = jest.fn();

jest.mock('@/components2024/ContextMenuView/ContextMenuView', () => ({
  ContextMenuView: jest.fn(),
}));

jest.mock('../useDeleteAccountModal', () => ({
  useDeleteAccountModal: () => mockUseDeleteAccountModal(),
}));

jest.mock('@/hooks/account', () => ({
  storeApiAccounts: {
    getPinAddresses: jest.fn(() => []),
    togglePinAddressAsync: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/hooks/theme', () => ({
  apisTheme: {
    getBinaryMode: jest.fn(() => 'light'),
  },
}));

jest.mock('@/components2024/AliasNameEditModal/useAliasNameEditModal', () => ({
  aliasNameEditModal: {
    show: jest.fn(),
  },
}));

jest.mock('@/components2024/Toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

jest.mock('@/components/AddressViewer/CopyAddress', () => ({
  toastCopyAddressSuccess: jest.fn(),
}));

jest.mock('@/utils/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('@rabby-wallet/base-utils', () => ({
  addressUtils: {
    isSameAddress: (left: string, right: string) => left === right,
  },
}));

const { AddressItemContextMenu } =
  require('./AddressItemContextMenu') as typeof import('./AddressItemContextMenu');

const account = {
  address: '0x1234',
  type: 'Simple Key Pair',
  brandName: 'Rabby',
} as KeyringAccountWithAlias;

const child = React.createElement('Child');

const invokeFunctionElement = (element: React.ReactElement<any>) => {
  const Component = element.type as React.FC<any>;
  return Component(element.props) as React.ReactElement<any>;
};

const getContextMenuElement = (
  actions: React.ComponentProps<typeof AddressItemContextMenu>['actions'],
) => {
  let element = AddressItemContextMenu({
    account,
    actions,
    children: child,
  }) as React.ReactElement<any>;

  if (actions.includes('delete')) {
    element = invokeFunctionElement(element);
  }

  return invokeFunctionElement(element);
};

describe('AddressItemContextMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not initialize delete behavior for menus without delete', () => {
    const contextMenuElement = getContextMenuElement(['copy', 'edit']);

    expect(mockUseDeleteAccountModal).not.toHaveBeenCalled();
    expect(
      (contextMenuElement.props.getMenuConfig() as MenuConfig).menuActions.map(
        action => action.key,
      ),
    ).toEqual(['copy', 'edit']);
  });

  it('initializes delete behavior only for delete-capable menus', () => {
    const contextMenuElement = getContextMenuElement([
      'copy',
      'pin',
      'edit',
      'delete',
    ]);

    expect(mockUseDeleteAccountModal).toHaveBeenCalledTimes(1);

    const deleteAction = (
      contextMenuElement.props.getMenuConfig() as MenuConfig
    ).menuActions.find(action => action.key === 'delete');
    deleteAction?.action?.();

    expect(mockRemoveAccount).toHaveBeenCalledWith({
      account,
      onFinished: expect.any(Function),
    });

    mockRemoveAccount.mock.calls[0][0].onFinished();
    expect(mockToastSuccess).toHaveBeenCalledWith('global.Deleted');
  });
});
