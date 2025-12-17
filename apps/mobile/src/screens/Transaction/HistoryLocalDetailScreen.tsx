/* eslint-disable react-native/no-inline-styles */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useInterval, useMemoizedFn, useMount, useRequest } from 'ahooks';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { createGetStyles2024 } from '@/utils/styles';
import { StackActions, useRoute } from '@react-navigation/native';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import HeaderTitleText2024 from '@/components2024/ScreenHeader/HeaderTitleText';

import { TransactionGroup } from '@/core/services/transactionHistory';
import { transactionHistoryService } from '@/core/services';
import { CHAINS_ENUM } from '@debank/common';
import { findMaxGasTx } from '@/core/utils/tx';
import BigNumber from 'bignumber.js';
import { ApproveToken } from './components/Actions/ApproveToken';
import { ApproveNFT } from './components/Actions/ApproveNFT';
import { ApproveNFTCollection } from './components/Actions/ApproveNFTCollection';
import { RevokeNFT } from './components/Actions/RevokeNFT';
import { RevokeNFTCollection } from './components/Actions/RevokeNFTCollection';
import { RevokeToken } from './components/Actions/RevokeToken';
import { CancelTx } from './components/Actions/CancelTx';
import { DeployContact } from './components/Actions/DeployContract';
import { Swap } from './components/Actions/Swap';
import { Send } from './components/Actions/Send';
import { useTranslation } from 'react-i18next';
import { UnknownAction } from './components/Actions/UnknownAction';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { findAccountByPriority } from '@/utils/account';
import { HistoryItemCateType } from './components/type';

function HistoryLocalDetailScreen(): JSX.Element {
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'HistoryLocalDetail'
      >
    >();
  const {
    data: _data,
    // canCancel,
    isForMultipleAddress,
    title,
    type,
    onPressAddToWhitelistButton,
  } = route.params || {};
  const [data, setData] = React.useState<TransactionGroup>(_data);
  const isPending = useMemo(() => data.isPending, [data]);
  const isFailed = useMemo(() => data.isFailed, [data]);
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { bottom } = useSafeAreaInsets();
  const { t } = useTranslation();

  const fetchRefreshData = useCallback(() => {
    if (!isPending) {
      // has done
      return;
    }

    const address = data.address;
    const chainId = data.chainId;
    const nonce = data.nonce;
    const groups = transactionHistoryService.getPendingTxsByNonce(
      address,
      chainId,
      nonce,
    );

    if (groups?.[0]) {
      setData(groups[0]);
    }
  }, [isPending, data]);

  useInterval(fetchRefreshData, 5000);

  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const getHeaderTitle = React.useCallback(() => {
    return (
      <HeaderTitleText2024 style={styles.headerTitleStyle}>
        {title || t('page.transactions.itemTitle.Default')}
      </HeaderTitleText2024>
    );
  }, [title, styles.headerTitleStyle, t]);

  useEffect(() => {
    if (!data.isPending) {
      const rawId = `${data.address.toLowerCase()}-${data.maxGasTx.hash}`;
      transactionHistoryService.clearSuccessAndFailSingleId(rawId);
    }
  }, [data]);

  useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
    });
  }, [setNavigationOptions, getHeaderTitle]);

  const needUseSwap = useMemo(() => {
    if (type === HistoryItemCateType.Swap) {
      return true;
    }
  }, [type]);

  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });

  const txAccount = useMemo(() => {
    const keyringType = data.keyringType;
    let account: KeyringAccountWithAlias | undefined;
    const canUseAccountList = accounts.filter(acc => {
      return (
        isSameAddress(acc.address, data.address) &&
        acc.type !== KEYRING_TYPE.WatchAddressKeyring
      );
    });
    if (keyringType) {
      account = canUseAccountList.find(acc => acc.type === data.keyringType);
    }
    if (!account) {
      account = findAccountByPriority(canUseAccountList);
    }
    return account;
  }, [accounts, data.address, data.keyringType]);

  return (
    <NormalScreenContainer2024
      type={!isLight ? 'bg1' : 'bg2'}
      style={{
        // position: 'relative',
        paddingBottom:
          needUseSwap || data.maxGasTx.action?.actionData?.send ? 0 : bottom,
        paddingTop: 24,
        paddingHorizontal:
          needUseSwap || data.maxGasTx.action?.actionData?.send ? 0 : 16,
      }}>
      {data.maxGasTx.action?.actionData?.approveToken ? (
        <ApproveToken
          data={data}
          isSingleAddress={!isForMultipleAddress}
          account={txAccount}
        />
      ) : data.maxGasTx.action?.actionData?.approveNFT ? (
        <ApproveNFT
          data={data}
          isSingleAddress={!isForMultipleAddress}
          account={txAccount}
        />
      ) : data.maxGasTx.action?.actionData?.approveNFTCollection ? (
        <ApproveNFTCollection
          data={data}
          isSingleAddress={!isForMultipleAddress}
          account={txAccount}
        />
      ) : data.maxGasTx.action?.actionData?.revokeNFT ? (
        <RevokeNFT
          data={data}
          isSingleAddress={!isForMultipleAddress}
          account={txAccount}
        />
      ) : data.maxGasTx.action?.actionData?.revokeNFTCollection ? (
        <RevokeNFTCollection
          data={data}
          isSingleAddress={!isForMultipleAddress}
          account={txAccount}
        />
      ) : data.maxGasTx.action?.actionData?.revokeToken ? (
        <RevokeToken
          data={data}
          isSingleAddress={!isForMultipleAddress}
          account={txAccount}
        />
      ) : data.maxGasTx.action?.actionData?.cancelTx ? (
        <CancelTx
          data={data}
          isSingleAddress={!isForMultipleAddress}
          account={txAccount}
        />
      ) : data.maxGasTx.action?.actionData?.deployContract ? (
        <DeployContact
          data={data}
          isSingleAddress={!isForMultipleAddress}
          account={txAccount}
        />
      ) : needUseSwap ? (
        <Swap
          data={data}
          isSingleAddress={!isForMultipleAddress}
          account={txAccount}
        />
      ) : data.maxGasTx.action?.actionData?.send ? (
        <Send
          data={data}
          isSingleAddress={!isForMultipleAddress}
          onPressAddToWhitelistButton={onPressAddToWhitelistButton}
          account={txAccount}
        />
      ) : (
        <UnknownAction
          data={data}
          isSingleAddress={!isForMultipleAddress}
          account={txAccount}
        />
      )}
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  detailContainer: {
    // flex: 1,
    width: '100%',
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  ghostButton: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-info'],
  },
  primaryButton: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['brand-default'],
  },
  primaryTitle: {
    color: colors2024['brand-default'],
  },
  ghostTitle: {
    color: colors2024['neutral-title-1'],
  },
  iconSwitchArrow: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 200,
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -22,
  },
  tokenAmountTextList: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  colomnBox: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  isSendTextColor: {
    color: colors2024['neutral-title-1'],
  },
  isFailBox: {
    opacity: 0.3,
  },
  image: {
    width: 46,
    height: 46,
  },
  fromTokenBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
    gap: 10,
  },
  toTokenBox: {
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
  },
  singleBox: {
    width: '100%',
    height: 92,
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'space-between',
    alignContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexDirection: 'row',
  },
  tokenAmountText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  mutliBox: {
    width: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'center',
    alignContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
    // flexDirection: 'row',
    gap: 12,
  },
  doubleBox: {
    justifyContent: 'center',
    alignContent: 'center',
    flexDirection: 'row',
    height: 110,
    gap: 10,
    position: 'relative',
  },

  buttonContainer: {
    position: 'absolute',
    flexDirection: 'row',
    height: 60,
    bottom: 40,
    width: '100%',
    gap: 16,
    left: 16,
  },
  itemAliaName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitleText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  itemAddressText: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  itemContentText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  headerTitleStyle: {
    color: colors2024['neutral-title-1'],
    fontWeight: '900',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
  },

  statuItemText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    marginLeft: 4,
  },

  headerItem: {},
}));

export { HistoryLocalDetailScreen };
