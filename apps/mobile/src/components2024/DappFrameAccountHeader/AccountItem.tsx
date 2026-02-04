import { Account } from '@/core/services/preference';
import { apiContact } from '@/core/apis';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { ellipsisAddress } from '@/utils/address';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';
import { useTheme2024 } from '@/hooks/theme';
import { AccountSelectorPopup } from '@/components2024/AccountSelector/AccountSelectorPopup';
import React, { useCallback, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { getStyle } from './styles';
import { useLendingAccountExtraInfo } from './hook/lendingAccountHook';
import { usePerpsDappAccountExtraInfo } from './hook/perpsAccountHook';
import { INNER_DAPP_LIST } from './constants';
import { useTranslation } from 'react-i18next';
import { usePredictDappAccountExtraInfo } from './hook/predictAccountHook';

type Props = {
  account?: Account;
  isShowAccountList?: boolean;
  onPress?: () => void;
  onCloseAccountList?: () => void;
  onSelectAccount?: (account: Account) => void;
  disablePopup?: boolean;
  renderRight?: React.ComponentProps<
    typeof AccountSelectorPopup
  >['renderRight'];
  renderNameAddon?: React.ComponentProps<
    typeof AccountSelectorPopup
  >['renderNameAddon'];
  sortAccounts?: React.ComponentProps<
    typeof AccountSelectorPopup
  >['sortAccounts'];
  dappId: string;
  renderRowTitle?: React.ComponentProps<
    typeof AccountSelectorPopup
  >['renderRowTitle'];
  renderTitle?: () => React.ReactNode;
};

const AccountItemInner = ({
  account,
  isShowAccountList,
  onPress,
  onCloseAccountList,
  onSelectAccount,
  disablePopup,
  renderRight,
  renderNameAddon,
  sortAccounts,
  dappId,
  renderRowTitle,
  renderTitle,
}: Props) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const alias = React.useMemo(() => {
    if (!account?.address) {
      return;
    }
    return apiContact.getAliasName(account?.address);
  }, [account?.address]);

  if (!account) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          onPress?.();
        }}
        disabled={!account}>
        <View style={styles.container}>
          {account ? (
            <View style={styles.addressContainer}>
              <WalletIcon
                style={styles.walletIcon}
                width={18}
                height={18}
                type={account.brandName}
                address={account.address}
              />
              <Text style={styles.address}>
                {alias || ellipsisAddress(account?.address)}
              </Text>
              <CaretArrowIconCC
                dir="down"
                style={[isShowAccountList ? styles.reverseCaret : null]}
                width={18}
                height={18}
                bgColor={colors2024['neutral-bg-5']}
                lineColor={colors2024['neutral-title-1']}
              />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
      {!disablePopup ? (
        <AccountSelectorPopup
          visible={!!isShowAccountList}
          onClose={onCloseAccountList}
          value={account}
          onChange={nextAccount => {
            onSelectAccount?.(nextAccount);
            onCloseAccountList?.();
          }}
          renderRight={renderRight}
          renderNameAddon={renderNameAddon}
          sortAccounts={sortAccounts}
          checkIconPosition={'name'}
          title={
            renderTitle ? renderTitle() : t('page.DAppFrame.selectAWallet')
          }
          isShowWatchAddressSection={false}
          renderRowTitle={renderRowTitle}
        />
      ) : null}
    </>
  );
};

const LendingAccountItem = (props: Props) => {
  const { dappId } = props;
  const extraProps = useLendingAccountExtraInfo(dappId);

  return <AccountItemInner {...props} {...extraProps} />;
};

const PerpsAccountItem = (props: Props) => {
  const { dappId } = props;
  const extraProps = usePerpsDappAccountExtraInfo(dappId);

  return <AccountItemInner {...props} {...extraProps} />;
};

const PredictAccountItem = (props: Props) => {
  const { dappId } = props;
  const extraProps = usePredictDappAccountExtraInfo(dappId);

  return <AccountItemInner {...props} {...extraProps} />;
};

export const AccountItem = (props: Props) => {
  const { dappId } = props;
  const { colors2024 } = useTheme2024();
  const { t } = useTranslation();
  const [isLending, isPerps] = useMemo(
    () => [
      INNER_DAPP_LIST.LENDING.some(item => item.id === dappId),
      INNER_DAPP_LIST.PERPS.some(item => item.id === dappId),
    ],
    [dappId],
  );

  const renderLendingRowTitle = useCallback(
    () => (
      <View
        style={{
          paddingHorizontal: 26,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Text
          style={{
            color: colors2024['neutral-secondary'],
            textAlign: 'center',
            fontFamily: 'SF Pro Rounded',
            fontSize: 16,
            fontStyle: 'normal',
            fontWeight: '400',
          }}>
          {t('page.DAppFrame.walletBalance')}
        </Text>
        <Text
          style={{
            color: colors2024['neutral-secondary'],
            textAlign: 'center',
            fontFamily: 'SF Pro Rounded',
            fontSize: 16,
            fontStyle: 'normal',
            fontWeight: '400',
          }}>
          {t('page.DAppFrame.netWorth')}
        </Text>
      </View>
    ),
    [colors2024, t],
  );

  if (isLending) {
    return (
      <LendingAccountItem {...props} renderRowTitle={renderLendingRowTitle} />
    );
  }

  if (isPerps) {
    return <PerpsAccountItem {...props} />;
  }
  return (
    <PredictAccountItem {...props} renderRowTitle={renderLendingRowTitle} />
  );
};
