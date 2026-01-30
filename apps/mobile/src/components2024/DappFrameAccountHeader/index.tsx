import { Account } from '@/core/services/preference';
import { KeyringAccountWithAlias } from '@/core/apis/account';
import { HeaderBackPressable, useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountItem } from './AccountItem';
import { DappSelect } from './DappSelect';
import { useDappListWithValue } from './useDappListWithValue';
import { getStyle } from './styles';
import type { DappSelectItem } from './constants';

export { INNER_DAPP_LIST } from './constants';
export type { DappSelectItem } from './constants';

export const DappFrameAccountHeader_LAYOUT = {
  height: 38,
};

export const DappFrameAccountHeader = (props: {
  account?: Account | KeyringAccountWithAlias;
  onPressAccountList?: () => void;
  isShowAccountList?: boolean;
  title?: React.ReactNode;
  activeId: string;
  dAppList: DappSelectItem[];
  dappSelectTitle?: string;
  onSelectDapp?: (item: DappSelectItem) => void;
  onSelectAccount?: (account: Account) => void;
  rightAddon?: React.ReactNode;
  disableAccountPopup?: boolean;
}) => {
  const {
    account,
    onPressAccountList,
    isShowAccountList,
    title,
    activeId,
    dAppList,
    dappSelectTitle,
    onSelectDapp,
    onSelectAccount,
    rightAddon,
    disableAccountPopup,
  } = props;

  const navigation = useRabbyAppNavigation();
  const { styles } = useTheme2024({ getStyle });
  const [isAccountSelectorOpen, setIsAccountSelectorOpen] =
    React.useState(false);
  const isAccountSelectorControlled = isShowAccountList !== undefined;
  const accountSelectorVisible = isAccountSelectorControlled
    ? !!isShowAccountList
    : isAccountSelectorOpen;

  const dappListWithValue = useDappListWithValue({ dAppList });

  const headerLeft = React.useCallback(() => {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          padding: 0,
        }}>
        <HeaderBackPressable />
        <DappSelect
          activeId={activeId}
          list={dappListWithValue}
          title={dappSelectTitle}
          onSelect={onSelectDapp}
        />
      </View>
    );
  }, [activeId, dappSelectTitle, dappListWithValue, onSelectDapp]);

  const handleOpenAccountSelector = React.useCallback(() => {
    if (!isAccountSelectorControlled) {
      setIsAccountSelectorOpen(true);
    }
    onPressAccountList?.();
  }, [isAccountSelectorControlled, onPressAccountList]);

  const handleCloseAccountSelector = React.useCallback(() => {
    if (!isAccountSelectorControlled) {
      setIsAccountSelectorOpen(false);
    }
  }, [isAccountSelectorControlled]);

  const handleSelectAccount = React.useCallback(
    (nextAccount: Account) => {
      onSelectAccount?.(nextAccount);
      if (!isAccountSelectorControlled) {
        setIsAccountSelectorOpen(false);
      }
    },
    [isAccountSelectorControlled, onSelectAccount],
  );

  const headerRight = React.useCallback(() => {
    const accountItem = (
      <AccountItem
        account={account}
        isShowAccountList={accountSelectorVisible}
        onPress={handleOpenAccountSelector}
        onCloseAccountList={handleCloseAccountSelector}
        onSelectAccount={handleSelectAccount}
        disablePopup={disableAccountPopup}
        dappId={activeId}
      />
    );

    if (!rightAddon) {
      return accountItem;
    }

    return (
      <View style={styles.headerRight}>
        {rightAddon}
        {accountItem}
      </View>
    );
  }, [
    account,
    accountSelectorVisible,
    activeId,
    disableAccountPopup,
    handleCloseAccountSelector,
    handleOpenAccountSelector,
    handleSelectAccount,
    rightAddon,
    styles.headerRight,
  ]);

  const { top } = useSafeAreaInsets();

  const header = React.useCallback(() => {
    return (
      <View
        style={{
          marginTop: top,
          height: DappFrameAccountHeader_LAYOUT.height,
          paddingHorizontal: 12,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          {headerLeft()}
          {headerRight()}
        </View>
      </View>
    );
  }, [headerLeft, headerRight, top]);

  React.useEffect(() => {
    navigation.setOptions({
      header,
    });
  }, [header, navigation, title]);

  return null;
};
