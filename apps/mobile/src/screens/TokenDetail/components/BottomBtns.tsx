import { toast } from '@/components2024/Toast';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  RootNames,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { RootStackParamsList } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { TokenMoreSheet, type TokenMoreAction } from './TokenMoreSheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { RcIconBridge, RcIconSend, RcIconSwap } from '@/assets2024/singleHome';
import RcIconReceiveCC from '@/assets2024/singleHome/receive-cc.svg';
import { RestoreRemovedTokenActions } from './RemovedToken';
import { StackActions, useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import RcIconSendCC from '@/assets2024/singleHome/send.svg';
import RcIconSwapCC from '@/assets2024/singleHome/swap.svg';
import RcIconMoreCC from '@/assets/icons/home/more-cc.svg';
import { findChain, findChainByServerID } from '@/utils/chain';
import { useSetAtom } from 'jotai';
import { isFromBackAtom } from '@/screens/Swap/hooks/atom';
import { CHAINS_ENUM } from '@debank/common';
import { ITokenItem } from '@/store/tokens';
import { Text } from '@/components/Typography';

type HomeProps = NativeStackScreenProps<RootStackParamsList>;

export const TokenDetailBottomBtns = ({
  token,
  finalAccount,
  tokenSelectType,
  disableSwapBridge,
  isRemoved = false,
}: {
  token: ITokenItem;
  finalAccount: KeyringAccountWithAlias | null;
  tokenSelectType?: import('@/components/Token/TokenSelectorSheetModal').TokenSelectType;
  disableSwapBridge?: boolean;
  isRemoved?: boolean;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const navigation = useNavigation<HomeProps['navigation']>();
  const moreSheetModalRef = React.useRef<BottomSheetModal>(null);
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { navigateToSendPolyScreen } = useSendRoutes();
  const setIsFromBack = useSetAtom(isFromBackAtom);

  const isFromSwap =
    !!tokenSelectType && ['swapTo', 'swapFrom'].includes(tokenSelectType);

  const moreItems: TokenMoreAction[] = [
    {
      key: 'Receive',
      title: t('page.home.services.receive'),
      Icon: RcIconReceiveCC,
      iconColor: colors2024['blue-default'],
      onPress: async () => {
        if (!finalAccount) {
          return;
        }
        const chainItem = !token?.chain
          ? null
          : findChainByServerID(token?.chain);
        if (finalAccount) {
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.Receive,
              params: {
                account: finalAccount,
                tokenSymbol: token.symbol,
                chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
              },
            }),
          );
        }
      },
    },
    {
      key: 'Bridge',
      title: t('page.home.services.bridge'),
      Icon: RcIconBridge,
      disabled: disableSwapBridge,
      onPress: async () => {
        const chain = findChain({
          serverId: token.chain,
        });

        await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
        setIsFromBack(false);
        navigation.push(RootNames.StackTransaction, {
          screen: RootNames.SwapBridge,
          params: {
            activeTab: 'bridge',
            chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
            tokenId: token?.id,
          },
        });
      },
    },
  ];
  const handleSend = async () => {
    const chain = findChain({
      serverId: token.chain,
    });
    await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
    setIsFromBack(false);
    navigateToSendPolyScreen(true, {
      chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
      tokenId: token?.id,
    });
  };
  const handleSwap = async () => {
    const chain = findChain({
      serverId: token.chain,
    });
    if (disableSwapBridge) {
      toast.error(t('page.tokenDetail.customTestnetNotSupported'));
      return;
    }

    await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
    setIsFromBack(false);
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.SwapBridge,
      params: {
        activeTab: 'swap',
        chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
        tokenId: token?.id,
        type: tokenSelectType === 'swapTo' ? 'Buy' : 'Sell',
        address: finalAccount?.address,
        isFromSwap,
      },
    });
  };
  if (isRemoved) {
    return (
      <RestoreRemovedTokenActions
        token={token}
        moreMenuActions={[
          {
            key: 'Send',
            title: t('page.home.services.send'),
            onPress: handleSend,
            Icon: RcIconSend,
          },
          {
            key: 'Swap',
            title: t('page.home.services.swap'),
            onPress: handleSwap,
            Icon: RcIconSwap,
            disabled: disableSwapBridge,
          },
          ...moreItems,
        ]}
      />
    );
  }

  return (
    <>
      <View style={styles.footer}>
        <View style={styles.container}>
          <View style={styles.group}>
            <View style={styles.leftActions}>
              <Pressable style={styles.action} onPress={handleSend}>
                <RcIconSendCC
                  width={22}
                  height={22}
                  style={styles.actionIcon}
                />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.actionText]}>
                  {t('page.home.services.send')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.action,
                  styles.blueAction,
                  disableSwapBridge && styles.disabledAction,
                ]}
                onPress={handleSwap}>
                <RcIconSwapCC
                  width={22}
                  height={22}
                  style={styles.actionIcon}
                />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.actionText]}>
                  {t('page.home.services.swap')}
                </Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.moreAction}
              accessibilityRole="button"
              accessibilityLabel={t('page.tokenDetail.removed.more')}
              onPress={() => moreSheetModalRef.current?.present()}>
              <RcIconMoreCC
                width={22}
                height={22}
                color={colors2024['neutral-body']}
              />
            </Pressable>
          </View>
        </View>
      </View>
      <TokenMoreSheet
        modalRef={moreSheetModalRef}
        items={moreItems}
        onDisabledAction={() =>
          toast.error(t('page.tokenDetail.customTestnetNotSupported'))
        }
      />
    </>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  footer: {
    width: '100%',
    height:
      BOTTOM_BUTTON_TOP_OFFSET +
      BOTTOM_BUTTON_DOUBLE_HEIGHT +
      getBottomButtonBottomOffset(ctx.safeAreaInsets.bottom),
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
  },
  group: {
    // justifyContent: 'space-between',
    flexDirection: 'row',
    gap: 10,
  },
  leftActions: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    gap: 4,
    height: BOTTOM_BUTTON_DOUBLE_HEIGHT,
    flex: 1,
    paddingHorizontal: 37,
    backgroundColor: ctx.colors2024['green-default'],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 10,
  },
  blueAction: {
    backgroundColor: ctx.colors2024['brand-default'],
  },
  disabledAction: {
    opacity: 0.6,
  },
  actionIcon: {
    width: 22,
    height: 22,
  },
  moreAction: {
    height: BOTTOM_BUTTON_DOUBLE_HEIGHT,
    width: BOTTOM_BUTTON_DOUBLE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ctx.colors2024['neutral-line'],
  },
  actionText: {
    color: ctx.colors2024['neutral-InvertHighlight'],
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));
