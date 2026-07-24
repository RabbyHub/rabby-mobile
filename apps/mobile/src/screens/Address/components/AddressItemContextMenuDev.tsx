import {
  ContextMenuView,
  type MenuAction,
  type MenuConfig,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { apisTheme } from '@/hooks/theme';
import { keyBy } from 'lodash';
import React from 'react';
import { toast } from '@/components2024/Toast';
import { AccountInfoEntity } from '@/databases/entities/accountInfo';
import i18n from '@/utils/i18n';

const MenuIcons = {
  deleteDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_delete_dark.png'),
  delete: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_delete.png'),
};
interface Props {
  account: KeyringAccountWithAlias;
  children: React.ReactElement<any>;
  preViewBorderRadius?: number;
  actions: 'dev:removeAddedRecord'[];
}
export const AddressItemContextMenuDev: React.FC<Props> = props => {
  const { account, children, actions, preViewBorderRadius = 20 } = props;

  const getMenuConfig = (): MenuConfig => {
    const isDarkTheme = apisTheme.getBinaryMode() === 'dark';
    const menuActionDict = keyBy(
      (
        [
          {
            title: i18n.t('page.addressDetail.addressListScreen.delete'),
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

    return {
      menuTitle: account.address,
      menuActions: actions
        .map(key => menuActionDict[key])
        .filter(v => v) as MenuAction[],
    };
  };

  return (
    <ContextMenuView
      getMenuConfig={getMenuConfig}
      preViewBorderRadius={preViewBorderRadius}
      triggerProps={{ action: 'longPress' }}>
      {children}
    </ContextMenuView>
  );
};
