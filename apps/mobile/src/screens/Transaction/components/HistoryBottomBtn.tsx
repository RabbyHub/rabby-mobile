import React, { useCallback, useMemo } from 'react';
import RcIconSend from '@/assets2024/icons/history/IconSend.svg';
import RcIconSwitch from '@/assets2024/icons/history/IconSwitch.svg';
// import RcIconContract from '@/assets/icons/history/contract.svg';
import RcIconApproval from '@/assets2024/icons/history/IconApprove.svg';
import RcIconReceive from '@/assets2024/icons/history/IconReceive.svg';
import RcIconRevoke from '@/assets2024/icons/history/IconRevoke.svg';
import RcIconContract from '@/assets2024/icons/history/IconContract.svg';
import RcIconDefault from '@/assets2024/icons/history/IconDefault.svg';
import RcIconCancel from '@/assets2024/icons/history/IconCancel.svg';
import RcIconSwitchArrow from '@/assets2024/icons/history/IconSwitchArrow.svg';
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  ViewStyle,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { AssetAvatar } from '@/components';
import {
  NFTItem,
  TokenItem,
  TxDisplayItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { Media } from '@/components/Media';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatNumber, numberWithCommasIsLtOne } from '@/utils/number';
import { HistoryItemCateType, HistoryItemIcon } from './HistoryItemIcon';
import { getTokenSymbol } from '@/utils/token';
import { useTranslation } from 'react-i18next';
import { navigate, naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { Button } from '@/components2024/Button';
import { strings } from '@/utils/i18n';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { StackActions } from '@react-navigation/native';
import { findChainByServerID } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';
import { approveToken, revokeNFTApprove } from '@/core/apis/approvals';
import { resetNavigationTo } from '@/hooks/navigation';
import { HistoryDisplayItem } from '../MultiAddressHistory';

interface ItemProps {
  status: number;
  tokenDict: Record<string, TokenItem | NFTItem>;
  className?: string;
  type: HistoryItemCateType;
  chain: string;
  receives: TxDisplayItem['receives'];
  sends: TxDisplayItem['sends'];
  approve: TxDisplayItem['token_approve'];
  data: HistoryDisplayItem;
  isForMultipleAdderss?: boolean;
}

export const HistoryBottomBtn = ({
  tokenDict,
  status,
  type,
  sends,
  data,
  approve,
  chain,
  receives,
  isForMultipleAdderss = true,
}: ItemProps) => {
  console.log('HistoryBottomBtn type', type);
  const { t } = useTranslation();
  const { navigation } = useSafeSetNavigationOptions();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const isFail = useMemo(() => status !== 1, [status]);

  switch (type) {
    case HistoryItemCateType.Send: {
      const isNft = sends[0]?.token_id?.length === 32;
      return isNft ? null : (
        <View style={styles.buttonContainer}>
          <Button
            onPress={() => {
              const sendToken = tokenDict[sends[0]?.token_id];
              const chainItem = !sendToken?.chain
                ? null
                : findChainByServerID(sendToken?.chain);
              navigation.dispatch(
                StackActions.push(RootNames.StackTransaction, {
                  screen: isForMultipleAdderss
                    ? RootNames.MultiSend
                    : RootNames.Send,
                  params: {
                    chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
                    tokenId: sends[0]?.token_id,
                  },
                }),
              );
            }}
            title={strings('page.transactions.detail.SendAgain')}
          />
        </View>
      );
    }
    case HistoryItemCateType.Approve:
      const singleAmount = approve?.value;
      const revokeAmountStr =
        singleAmount && singleAmount < 1e9
          ? numberWithCommasIsLtOne(singleAmount, 2)
          : '';
      const tokenId = approve?.token_id || '';
      const tokenUUID = `${chain}_token:${tokenId}`;
      const tokenIsNft = tokenId?.length === 32;
      const singeToken = tokenDict[tokenId] || tokenDict[tokenUUID];
      const name = tokenIsNft
        ? strings('page.nft.title')
        : getTokenSymbol(singeToken as TokenItem);

      return (
        <View style={styles.buttonContainer}>
          <Button
            buttonStyle={styles.ghostButton}
            titleStyle={styles.ghostTitle}
            onPress={async () => {
              if (tokenIsNft) {
                // ？ confrim revoke nft approve
                await revokeNFTApprove(
                  {
                    chainServerId: chain,
                    nftTokenId: tokenId,
                    spender: approve?.spender!,
                    contractId: (data.tx as any)?.id,
                    abi: 'ERC721',
                    isApprovedForAll: true,
                  },
                  {
                    ga: { category: 'Security', source: 'tokenApproval' },
                  },
                );
              } else {
                await approveToken(chain, tokenId, approve?.spender!, 0, {
                  ga: {
                    category: 'Security',
                    source: 'tokenApproval',
                  },
                });
              }
              resetNavigationTo(navigation, 'Home');
            }}
            type={'ghost'}
            title={`${strings(
              'page.transactions.detail.Revoke',
            )} ${revokeAmountStr} ${name}`}
          />
        </View>
      );
    case HistoryItemCateType.Recieve:
      return null;
    case HistoryItemCateType.Swap:
      return (
        <View style={styles.buttonContainer}>
          <Button
            onPress={() => {
              const chainItem = !chain ? null : findChainByServerID(chain);
              navigation.dispatch(
                StackActions.push(RootNames.StackTransaction, {
                  screen: isForMultipleAdderss
                    ? RootNames.MultiSwap
                    : RootNames.Swap,
                  params: {
                    swapAgain: true,
                    chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
                    swapTokenId: [sends[0]?.token_id, receives[0]?.token_id],
                  },
                }),
              );
            }}
            title={strings('page.transactions.detail.SwapAgain')}
          />
        </View>
      );
    // todo
    case HistoryItemCateType.Contract:
    case HistoryItemCateType.Cancel:
    case HistoryItemCateType.Bridge:
    case HistoryItemCateType.UnKnown:
    default:
      return null;
  }
  // return <RcIconDefault style={[styles.image, style]} />;
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tokenAmountText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  ghostButton: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-info'],
  },
  ghostTitle: {
    color: colors2024['neutral-title-1'],
  },
  buttonContainer: {
    position: 'absolute',
    height: 60,
    bottom: 40,
    width: '100%',
    left: 16,
  },
}));
