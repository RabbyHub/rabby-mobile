import { RcIconBridge } from '@/assets2024/singleHome';
import { BSheetModal } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { toast } from '@/components/Toast';
import { RootNames } from '@/constant/layout';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { RootStackParamsList } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { StackActions, useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ColorValue, Pressable, Text, View } from 'react-native';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import RcIconSendCC from '@/assets2024/singleHome/send.svg';
import RcIconSwapCC from '@/assets2024/singleHome/swap.svg';
import RcIconMoreCC from '@/assets/icons/home/more-cc.svg';
import RcIconReceiveCC from '@/assets2024/singleHome/receive-cc.svg';
import { findChain, findChainByServerID } from '@/utils/chain';
import { useSetAtom } from 'jotai';
import { isFromBackAtom } from '@/screens/Swap/hooks/atom';
import { CHAINS_ENUM } from '@debank/common';
import { ITokenItem } from '@/store/tokens';

type HomeProps = NativeStackScreenProps<RootStackParamsList>;

const MORE_SHEET_MODAL_SNAPPOINTS = (actionsNum: number) => [
  80 + 70 * actionsNum,
];

export const TokenDetailBottomBtns = ({
  token,
  finalAccount,
  tokenSelectType,
}: {
  token: ITokenItem;
  finalAccount: KeyringAccountWithAlias | null;
  tokenSelectType?: import('@/components/Token/TokenSelectorSheetModal').TokenSelectType;
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

  const toastDisabledAction = useCallback(() => {
    toast.show(t('page.dashboard.assets.comingSoon'));
  }, [t]);

  const moreItems: {
    title: string;
    key: string;
    Icon: React.ComponentType<import('react-native-svg').SvgProps>;
    iconColor?: ColorValue;
    onPress: () => void;
    disabled?: boolean;
    badge?: number;
    badgeAlert?: boolean;
  }[] = [
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
      onPress: async () => {
        const chain = findChain({
          serverId: token.chain,
        });

        await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
        setIsFromBack(false);
        navigation.navigateDeprecated(RootNames.StackTransaction, {
          screen: RootNames.Bridge,
          params: {
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

    await switchSceneCurrentAccount('MakeTransactionAbout', finalAccount);
    setIsFromBack(false);
    navigation.navigateDeprecated(RootNames.StackTransaction, {
      screen: RootNames.Swap,
      params: {
        chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
        tokenId: token?.id,
        type: tokenSelectType === 'swapTo' ? 'Buy' : 'Sell',
        address: finalAccount?.address,
        isFromSwap,
      },
    });
  };
  const handleMore = () => {
    moreSheetModalRef.current?.present();
  };

  return (
    <>
      <View style={[styles.container]}>
        <View style={styles.group}>
          <View style={styles.leftActions}>
            <Pressable style={styles.action} onPress={handleSend}>
              <RcIconSendCC width={22} height={22} style={styles.actionIcon} />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.actionText]}>
                {t('page.home.services.send')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.action, styles.blueAction]}
              onPress={handleSwap}>
              <RcIconSwapCC width={22} height={22} style={styles.actionIcon} />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.actionText]}>
                {t('page.home.services.swap')}
              </Text>
            </Pressable>
          </View>
          <Pressable style={[styles.moreAction]} onPress={handleMore}>
            <RcIconMoreCC
              width={22}
              height={22}
              color={colors2024['neutral-body']}
            />
          </Pressable>
        </View>
      </View>

      <BSheetModal
        ref={moreSheetModalRef}
        backgroundStyle={styles.sheetModal}
        handleStyle={styles.sheetModal}
        snapPoints={MORE_SHEET_MODAL_SNAPPOINTS(moreItems.length)}>
        <AutoLockView as="BottomSheetView" style={styles.list}>
          {moreItems.map(item => (
            <Pressable
              style={[
                styles.item,
                styles.moreItem,
                !!item?.disabled && styles.disabledAction,
              ]}
              onPress={
                item.disabled
                  ? toastDisabledAction
                  : () => {
                      moreSheetModalRef.current?.dismiss();
                      item.onPress();
                    }
              }
              key={item.key}>
              <View style={[styles.sheetModalItemLeft]}>
                <item.Icon width={40} height={40} color={item.iconColor} />
                <Text style={styles.itemText}>{item.title}</Text>
              </View>
            </Pressable>
          ))}
        </AutoLockView>
      </BSheetModal>
    </>
  );
};

const BADGE_SIZE = 18;
const getStyles = createGetStyles2024(ctx => ({
  container: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingTop: 16,
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
    height: 52,
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
  item: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  moreItem: {
    justifyContent: 'space-between',
  },
  sheetModalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 1,
    width: '100%',
  },
  actionIcon: {
    width: 22,
    height: 22,
  },
  moreAction: {
    height: 52,
    width: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ctx.colors2024['neutral-line'],
  },
  itemText: {
    marginLeft: 16,
    color: ctx.colors2024['neutral-title-1'],

    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  sheetModalItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    maxWidth: '50%',
    // ...makeDebugBorder(),
  },
  chevron: {
    marginLeft: 'auto',
    width: 16,
    height: 16,
    color: ctx.colors2024['neutral-foot'],
  },
  list: {
    gap: 40,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  sheetModal: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  actionBadgeWrapper: {
    position: 'absolute',
    top: -4,
    right: -(BADGE_SIZE / 2),
    // ...makeDebugBorder(),
  },
  rightZero: {
    right: 0,
  },
  actionText: {
    color: ctx.colors2024['neutral-InvertHighlight'],
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  actionIconWrapper: {
    flexDirection: 'row',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ctx.colors2024['green-default'],
  },
}));
