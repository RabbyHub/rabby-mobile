import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { AssetAvatar, Tip } from '@/components';
import {
  NFTItem,
  TokenItem,
  TxDisplayItem,
} from '@rabby-wallet/rabby-api/dist/types';
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
import { findChain, findChainByServerID } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';
import { approveToken, revokeNFTApprove } from '@/core/apis/approvals';
import { resetNavigationTo } from '@/hooks/navigation';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import { fetchHistoryTokenUUId } from './utils';

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
  currentApprove: number;
  noRemainValue: boolean;
  isForMultipleAdderss?: boolean;
}

export const HistoryBottomBtn = ({
  tokenDict,
  noRemainValue,
  currentApprove,
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
              const sendToken =
                tokenDict[fetchHistoryTokenUUId(sends[0]?.token_id, chain)];
              console.log('chainItem sendToken', chain, sendToken);
              const chainItem = findChain({
                serverId: sendToken.chain,
              });
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
      const singleAmount = currentApprove || approve?.value;
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

      return tokenIsNft ? null : (
        <View style={styles.buttonContainer}>
          <Tip
            placement="top"
            content={
              noRemainValue
                ? strings('page.transactions.detail.NoApproveNeed')
                : undefined
            }>
            <Button
              // loading={btnLoading}
              disabled={noRemainValue}
              buttonStyle={[styles.ghostButton]}
              titleStyle={[
                styles.ghostTitle,
                noRemainValue && styles.ghostDisableButton,
              ]}
              onPress={async () => {
                if (tokenIsNft) {
                  // ？to confrim revoke nft approve
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
              type={'primary'}
              title={`${strings(
                'page.transactions.detail.Revoke',
              )} ${revokeAmountStr} ${name}`}
            />
          </Tip>
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
  ghostDisableButton: {
    color: colors2024['neutral-info'],
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
