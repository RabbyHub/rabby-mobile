import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable } from 'react-native';

import RcIconSendCC from '@/assets2024/icons/home/IconSendCC.svg';
import RcIconReceiveCC from '@/assets2024/icons/home/IconReceiveCC.svg';
import RcIconSwapCC from '@/assets2024/icons/home/IconSwapCC.svg';
import RcIconBridgeCC from '@/assets2024/icons/home/IconBridgeCC.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { findChain, findChainByServerID, getChain } from '@/utils/chain';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { isFromBackAtom } from '@/screens/Swap/hooks/atom';
import { useSetAtom } from 'jotai';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { CHAINS_ENUM } from '@/constant/chains';
import { StackActions, useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';
import { RootNames } from '@/constant/layout';
import { naviPush } from '@/utils/navigation';

type HomeProps = NativeStackScreenProps<RootStackParamsList>;

interface Props {
  token: AbstractPortfolioToken;
  isSingleAddress: boolean;
  finalAccount: KeyringAccountWithAlias | null;
  tokenSelectType?: import('@/components/Token/TokenSelectorSheetModal').TokenSelectType;
}
const TokenActions = ({
  token,
  isSingleAddress,
  finalAccount,
  tokenSelectType,
}: Props) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const setIsFromBack = useSetAtom(isFromBackAtom);
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const navigation = useNavigation<HomeProps['navigation']>();

  const isFromSwap =
    !!tokenSelectType && ['swapTo', 'swapFrom'].includes(tokenSelectType);

  const actions: {
    title: string;
    key: string;
    Icon: any;
    onPress: () => void;
    disabled?: boolean;
  }[] = useMemo(
    () => [
      {
        key: 'Send',
        title: t('page.home.services.send'),
        Icon: RcIconSendCC,
        onPress: async () => {
          const chain = findChain({
            serverId: token.chain,
          });
          if (isSingleAddress) {
            await switchSceneCurrentAccount(
              'MakeTransactionAbout',
              finalAccount,
            );
          }
          setIsFromBack(false);
          naviPush(RootNames.StackTransaction, {
            screen: RootNames.Send,
            params: {
              chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
              tokenId: token?._tokenId,
            },
          });
        },
      },
      {
        key: 'Receive',
        title: t('page.home.services.receive'),
        Icon: RcIconReceiveCC,
        onPress: async () => {
          if (!finalAccount) {
            return;
          }
          const chainItem = !token?.chain
            ? null
            : findChainByServerID(token?.chain);
          if (isSingleAddress) {
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
          } else {
            navigation.dispatch(
              StackActions.push(RootNames.StackAddress, {
                screen: RootNames.ReceiveAddressList,
                params: {
                  tokenSymbol: token.symbol,
                  chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
                },
              }),
            );
          }
        },
      },
      {
        key: 'Swap',
        title: t('page.home.services.swap'),
        Icon: RcIconSwapCC,
        onPress: async () => {
          const chain = findChain({
            serverId: token.chain,
          });

          await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
          setIsFromBack(false);
          naviPush(RootNames.StackTransaction, {
            screen: isSingleAddress ? RootNames.Swap : RootNames.MultiSwap,
            params: {
              chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
              tokenId: token?._tokenId,
              type: tokenSelectType === 'swapTo' ? 'Buy' : 'Sell',
              address: finalAccount?.address,
              isFromSwap,
            },
          });
        },
      },
      {
        key: 'Bridge',
        title: t('page.home.services.bridge'),
        Icon: RcIconBridgeCC,
        onPress: async () => {
          const chain = findChain({
            serverId: token.chain,
          });

          await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
          setIsFromBack(false);
          naviPush(RootNames.StackTransaction, {
            screen: isSingleAddress ? RootNames.Bridge : RootNames.MultiBridge,
            params: {
              chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
              tokenId: token?._tokenId,
            },
          });
        },
      },
    ],
    [
      finalAccount,
      isFromSwap,
      isSingleAddress,
      navigation,
      setIsFromBack,
      switchSceneCurrentAccount,
      t,
      token?._tokenId,
      token.chain,
      token.symbol,
      tokenSelectType,
    ],
  );
  return (
    <View style={styles.group}>
      {actions.map(item => (
        <Pressable
          style={[styles.action, !!item?.disabled && styles.disabledAction]}
          onPress={() => {
            if (!item.disabled) {
              item.onPress();
            }
          }}
          key={item.key}>
          <View style={styles.actionIconWrapper}>
            <item.Icon
              width={20}
              height={20}
              style={styles.actionIcon}
              color={colors2024['brand-default-icon']}
            />
          </View>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.actionText]}>
            {item.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

export default TokenActions;

const getStyles = createGetStyles2024(ctx => ({
  group: {
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  action: {
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  disabledAction: {
    opacity: 0.4,
  },
  actionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ctx.colors2024['brand-light-1'],
  },
  actionIcon: {
    width: 20,
    height: 20,
    shadowColor: 'rgba(112, 132, 255, 1)',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.12,
    shadowRadius: 11.6,
  },
  actionText: {
    color: ctx.colors2024['neutral-secondary'],
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
}));
