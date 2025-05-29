import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BridgeHistory, SwapItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components';
import { useTranslation } from 'react-i18next';
import { getTokenSymbol } from '@/utils/token';
import { TxStatusItem } from '@/screens/Transaction/HistoryDetailScreen';
import { findChain } from '@/utils/chain';
import ArrowSwapSVG from '@/assets2024/icons/common/arrow-swap-cc.svg';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { bridgeService, swapService } from '@/core/services';
import { useCurrentAccount } from '@/hooks/account';
export const BridgePendingTxItem = ({
  data,
  clearLocalPendingTxData,
  openHistory,
}: {
  data: BridgeHistory;
  clearLocalPendingTxData: () => void;
  openHistory: () => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const isPending = data.status === 'pending';
  const { currentAccount } = useCurrentAccount();

  const handlePress = () => {
    if (!isPending) {
      clearLocalPendingTxData();
      bridgeService.setOpenBridgeHistoryTs(currentAccount?.address ?? '');
    }

    openHistory();
  };

  const payToken = data.from_token;
  const receiveToken = data.to_token;

  const titleTextStr = useMemo(() => {
    return `${getTokenSymbol(payToken)}→${getTokenSymbol(receiveToken)}`;
  }, [payToken, receiveToken]);

  const SubTitleContainer = useMemo(() => {
    const ToText = t('page.swap.to') + ' ';
    const payChain = findChain({
      serverId: payToken?.chain,
    });
    const receiveChain = findChain({
      serverId: receiveToken?.chain,
    });

    return (
      <View style={styles.subTitleContainer}>
        <ChainIconImage
          size={14}
          chainServerId={payToken?.chain}
          isShowRPCStatus={true}
        />
        <Text style={styles.subTitleText}>{payChain?.name}</Text>
        <Text style={styles.subTitleText}>{ToText}</Text>
        <ChainIconImage
          size={14}
          chainServerId={receiveToken?.chain}
          isShowRPCStatus={true}
        />
        <Text style={styles.subTitleText}>{receiveChain?.name}</Text>
      </View>
    );
  }, [
    t,
    payToken,
    receiveToken,
    styles.subTitleContainer,
    styles.subTitleText,
  ]);

  const isFail = (data.status as any) === 'failed';

  return (
    <>
      <View style={styles.header}>
        <View style={styles.dottedLine} />
        <View style={styles.dot} />
        <View style={styles.dottedLine} />
      </View>
      <TouchableOpacity style={styles.container} onPress={handlePress}>
        <View style={styles.leftContainer}>
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
          <View style={styles.mainContainer}>
            <View style={styles.titleContainer}>
              <Text style={styles.titleText}>{titleTextStr}</Text>
            </View>
            {SubTitleContainer}
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
              <TxStatusItem status={isFail ? 0 : 1} showSuccess={true} />
              <Text style={styles.statusText}>
                {isFail
                  ? t('page.transactions.detail.Failed')
                  : t('page.transactions.detail.Succeeded')}
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
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
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
