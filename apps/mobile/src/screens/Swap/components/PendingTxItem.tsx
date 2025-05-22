import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SwapItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components';
import { useTranslation } from 'react-i18next';
import { getTokenSymbol } from '@/utils/token';
import { TxStatusItem } from '@/screens/Transaction/HistoryDetailScreen';
import { findChain } from '@/utils/chain';
import ArrowSwapSVG from '@/assets2024/icons/common/arrow-swap-cc.svg';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { swapService } from '@/core/services';
import { useCurrentAccount } from '@/hooks/account';
import { SendRequireData } from '@rabby-wallet/rabby-action/dist/types/actionRequireData';
import { getAliasName } from '@/core/apis/contact';
import { ellipsisAddress } from '@/utils/address';
export const PendingTxItem = ({
  data,
  clearLocalPendingTxData,
  isForMultipleAdderss,
  type,
}: {
  data: TransactionGroup;
  clearLocalPendingTxData: () => void;
  isForMultipleAdderss: boolean;
  type: 'send' | 'swap' | 'bridge';
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const chainItem = React.useMemo(
    () =>
      findChain({
        id: data?.chainId,
      }),
    [data?.chainId],
  );
  const isPending = data.isPending;
  const chainName = chainItem?.name || '';
  const { currentAccount } = useCurrentAccount();

  const handlePress = () => {
    if (!isPending) {
      clearLocalPendingTxData();
      swapService.setOpenSwapHistoryTs(currentAccount?.address ?? '');
    }

    navigate(RootNames.StackTransaction, {
      screen: RootNames.HistoryLocalDetail,
      params: {
        isForMultipleAdderss,
        data: data,
        title: t('page.swap.swapped'),
      },
    });
  };

  const swapActionData =
    data.maxGasTx.action?.actionData?.swap ||
    data.maxGasTx.action?.actionData?.unWrapToken ||
    data.maxGasTx.action?.actionData?.wrapToken;

  const sendActionData = data.maxGasTx.action?.actionData?.send;
  const payToken = swapActionData?.payToken;
  const receiveToken = swapActionData?.receiveToken;

  const titleTextStr = useMemo(() => {
    if (type === 'send') {
      return `${getTokenSymbol(sendActionData?.token)}`;
    } else {
      return `${getTokenSymbol(payToken)}→${getTokenSymbol(receiveToken)}`;
    }
  }, [type, sendActionData?.token, payToken, receiveToken]);

  const subTitleTextStr = useMemo(() => {
    if (type === 'send') {
      let address = '';
      const ToText = t('page.swap.to') + ' ';
      const acData = data.maxGasTx?.action?.actionData.send;
      const sendRequireData = data.maxGasTx?.action
        ?.requiredData as SendRequireData;
      const addr = acData?.to || sendRequireData?.protocol?.name;

      if (!addr) {
        address = t('page.transactions.detail.Unknown');
      } else {
        address = ToText + (getAliasName(addr) || ellipsisAddress(addr));
      }
      return address;
    } else {
      return chainName;
    }
  }, [type, chainName, t, data.maxGasTx]);

  return (
    <>
      <View style={styles.header}>
        <View style={styles.dottedLine} />
        <View style={styles.dot} />
        <View style={styles.dottedLine} />
      </View>
      <TouchableOpacity style={styles.container} onPress={handlePress}>
        <View style={styles.leftContainer}>
          {type === 'send' ? (
            <View style={styles.IconContainer}>
              <AssetAvatar logo={sendActionData?.token?.logo_url} size={36} />
            </View>
          ) : (
            <View style={styles.IconContainer}>
              <View style={styles.leftIcon}>
                {<AssetAvatar logo={payToken?.logo_url} size={23} />}
              </View>
              <View style={styles.rightIcon}>
                {<AssetAvatar logo={receiveToken?.logo_url} size={25} />}
              </View>
              <ArrowSwapSVG
                style={styles.arrow}
                color={colors2024['neutral-secondary']}
              />
            </View>
          )}
          <View style={styles.mainContainer}>
            <View style={styles.titleContainer}>
              <Text style={styles.titleText}>{titleTextStr}</Text>
            </View>
            <View style={styles.subTitleContainer}>
              <ChainIconImage
                size={14}
                chainEnum={chainItem?.enum}
                isShowRPCStatus={true}
              />
              <Text style={styles.subTitleText}>{subTitleTextStr}</Text>
            </View>
          </View>
        </View>

        <View style={styles.rightContainer}>
          {isPending ? (
            <View style={styles.statusContainer}>
              <TxStatusItem status={1} isPending={true} />
              <Text style={styles.statusText}>
                {t('page.transactions.detail.Pending')}
              </Text>
            </View>
          ) : (
            <View style={styles.statusContainer}>
              <TxStatusItem status={1} showSuccess={true} />
              <Text style={styles.statusText}>
                {t('page.transactions.detail.Succeeded')}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  IconContainer: {
    position: 'relative',
    width: 36,
    height: 36,
  },
  leftIcon: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 30,
  },
  rightIcon: {
    borderWidth: 2,
    borderColor: colors2024['neutral-bg-1'],
    position: 'absolute',
    right: -2,
    bottom: -3,
    borderRadius: 40,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  arrow: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 18,
    justifyContent: 'center',
  },
  dottedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: colors2024['neutral-line'],
    opacity: 0.5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 16,
    backgroundColor: colors2024['neutral-info'],
  },
  mainContainer: {
    gap: 2,
  },
  arrowIcon: {
    width: 16,
    height: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subTitleText: {
    color: colors2024['neutral-secondary'],
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    alignItems: 'center',
  },
  subTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  titleText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  leftContainer: {
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 2,
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
}));
