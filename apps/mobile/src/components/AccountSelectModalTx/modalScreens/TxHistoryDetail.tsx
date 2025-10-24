/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo } from 'react';
import { useInterval } from 'ahooks';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { createGetStyles2024 } from '@/utils/styles';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import HeaderTitleText2024 from '@/components2024/ScreenHeader/HeaderTitleText';

import { TransactionGroup } from '@/core/services/transactionHistory';
import { transactionHistoryService } from '@/core/services';
import { ApproveToken } from '@/screens/Transaction/components/Actions/ApproveToken';
import { ApproveNFT } from '@/screens/Transaction/components/Actions/ApproveNFT';
import { ApproveNFTCollection } from '@/screens/Transaction/components/Actions/ApproveNFTCollection';
import { RevokeNFT } from '@/screens/Transaction/components/Actions/RevokeNFT';
import { RevokeNFTCollection } from '@/screens/Transaction/components/Actions/RevokeNFTCollection';
import { RevokeToken } from '@/screens/Transaction/components/Actions/RevokeToken';
import { CancelTx } from '@/screens/Transaction/components/Actions/CancelTx';
import { DeployContact } from '@/screens/Transaction/components/Actions/DeployContract';
import { Swap } from '@/screens/Transaction/components/Actions/Swap';
import { Send } from '@/screens/Transaction/components/Actions/Send';
import { useTranslation } from 'react-i18next';
import { UnknownAction } from '@/screens/Transaction/components/Actions/UnknownAction';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { findAccountByPriority } from '@/utils/account';
import { HistoryItemCateType } from '@/screens/Transaction/components/type';
import { useAccountSelectModalCtx } from '../hooks';
import { View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Hex, isValidHexAddress } from '@metamask/utils';

function ScreenHistoryLocalDetail(): JSX.Element {
  const { viewingHistoryTxData, fnNavTo } = useAccountSelectModalCtx();
  if (!viewingHistoryTxData) {
    throw new Error(
      '[ScreenHistoryLocalDetail] viewingHistoryTxData is required',
    );
  }
  const {
    data: _data,
    isForMultipleAddress,
    title,
    type,
  } = viewingHistoryTxData || {};
  const [data, setData] = React.useState<TransactionGroup>(_data);
  const isPending = useMemo(() => data.isPending, [data]);
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

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

  useEffect(() => {
    if (!data.isPending) {
      const rawId = `${data.address.toLowerCase()}-${data.maxGasTx.hash}`;
      transactionHistoryService.clearSuccessAndFailSingleId(rawId);
    }
  }, [data]);

  const needUseSwap = useMemo(() => {
    return Boolean(
      type === HistoryItemCateType.Swap ||
        data.maxGasTx.action?.actionData?.swap ||
        data.maxGasTx.action?.actionData?.wrapToken ||
        data.maxGasTx.action?.actionData?.unWrapToken,
    );
  }, [data, type]);

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

  const onAddToWhitelist = useCallback<
    React.ComponentProps<typeof Send>['onPressAddToWhitelistButton'] & object
  >(
    data => {
      if (data?.to && isValidHexAddress(data?.to as Hex)) {
        fnNavTo('add-new-whitelist-addr', {
          inputValue: data.to,
        });
      }
    },
    [fnNavTo],
  );

  return (
    <View style={styles.detailContainer}>
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
          onPressAddToWhitelistButton={onAddToWhitelist}
          account={txAccount}
        />
      ) : (
        <UnknownAction
          data={data}
          isSingleAddress={!isForMultipleAddress}
          account={txAccount}
        />
      )}
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  detailContainer: {
    // flex: 1,
    width: '100%',
    marginTop: 20,
    borderRadius: 16,
    position: 'relative',
    paddingTop: 0,
    paddingBottom: 27,
    // backgroundColor: colors2024['neutral-bg-1'],
  },
}));

export { ScreenHistoryLocalDetail };
