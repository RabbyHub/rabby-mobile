import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { KeyringAccountWithAlias, usePinAddresses } from '@/hooks/account';
import { useGetBinaryMode } from '@/hooks/theme';
import { keyBy } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components2024/Toast';
import { AccountInfoEntity } from '@/databases/entities/accountInfo';

const MenuIcons = {
  deleteDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_delete_dark.png'),
  delete: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_delete.png'),
};
interface Props {
  account: KeyringAccountWithAlias;
  children: React.ReactElement;
  preViewBorderRadius?: number;
  actions: 'dev:removeAddedRecord'[];
}
export const AddressItemContextMenuDev: React.FC<Props> = props => {
  const { account, children, actions, preViewBorderRadius = 20 } = props;

  const { t } = useTranslation();
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const menuActionDict = React.useMemo(() => {
    return keyBy(
      (
        [
          {
            title: t('page.addressDetail.addressListScreen.delete'),
            icon: isDarkTheme ? MenuIcons.deleteDark : MenuIcons.delete,
            key: 'dev:removeAddedRecord',
            androidIconName: 'ic_rabby_menu_delete',
            destructive: true,
            async action() {
              await AccountInfoEntity.deleteByAccount(account);
              toast.success(
                `Removed ${account.address}(${account.type}) from newly added records`,
              );
            },
          },
        ] as MenuAction[]
      ).filter(Boolean),
      item => item.key,
    );
  }, [t, isDarkTheme, account]);

  const menuActions = React.useMemo(() => {
    return actions
      .map(key => {
        return menuActionDict[key];
      })
      .filter(v => v) as MenuAction[];
  }, [actions, menuActionDict]);

  return (
    <ContextMenuView
      menuConfig={{
        menuTitle: account.address,
        menuActions: menuActions,
      }}
      preViewBorderRadius={preViewBorderRadius}
      triggerProps={{ action: 'longPress' }}>
      {children}
    </ContextMenuView>
  );
};
