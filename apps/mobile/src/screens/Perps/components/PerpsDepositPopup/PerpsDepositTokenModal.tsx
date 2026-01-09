import { RcArrowRightCC } from '@/assets2024/icons/perps';
import { AssetAvatar } from '@/components';
import { Button } from '@/components2024/Button';
import { RootNames } from '@/constant/layout';
import { ARB_USDC_TOKEN_ITEM } from '@/constant/perps';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePerpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { ITokenItem } from '@/store/tokens';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  token?: ITokenItem | null;
  onCancel?: () => void;
  onNavigate?: () => void;
}

export const PerpsDepositTokenModal: React.FC<Props> = ({
  visible,
  onCancel,
  onNavigate,
  token,
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const isSwap = token?.chain === ARB_USDC_TOKEN_ITEM?.chain;
  const navigation = useRabbyAppNavigation();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { state } = usePerpsStore();

  if (!token) {
    return null;
  }

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          <Text style={styles.description}>
            {isSwap
              ? t('page.perps.PerpsDepositTokenModal.goSwapDesc')
              : t('page.perps.PerpsDepositTokenModal.goBridgeDesc')}
          </Text>
          <View style={styles.tokenSwap}>
            <AssetAvatar
              size={46}
              chain={token.chain}
              logo={token.logo_url}
              chainSize={18}
            />
            <RcArrowRightCC color={colors2024['neutral-foot']} />
            <AssetAvatar
              size={46}
              chain={ARB_USDC_TOKEN_ITEM.chain}
              logo={ARB_USDC_TOKEN_ITEM.logo_url}
              chainSize={18}
            />
          </View>
          <View style={styles.footer}>
            <View style={styles.containerStyle}>
              <Button
                type="ghost"
                title={t('global.cancel')}
                onPress={onCancel}
              />
            </View>
            <View style={styles.containerStyle}>
              <Button
                type="primary"
                title={
                  isSwap
                    ? t('page.perps.PerpsDepositTokenModal.swapBtn')
                    : t('page.perps.PerpsDepositTokenModal.bridgeBtn')
                }
                onPress={async () => {
                  await switchSceneCurrentAccount(
                    'MakeTransactionAbout',
                    state.currentPerpsAccount,
                  );
                  if (isSwap) {
                    navigation.navigateDeprecated(RootNames.StackTransaction, {
                      screen: RootNames.MultiSwap,

                      params: {
                        swapAgain: true,
                        chainEnum: findChain({ serverId: token.chain })?.enum,
                        swapTokenId: [token.id, ARB_USDC_TOKEN_ITEM.id],
                      },
                    });
                  } else {
                    navigation.navigateDeprecated(RootNames.StackTransaction, {
                      screen: RootNames.MultiBridge,

                      params: {
                        chainEnum: findChain({ serverId: token.chain })?.enum,
                        tokenId: token.id,
                        toChainEnum: findChain({
                          serverId: ARB_USDC_TOKEN_ITEM.chain,
                        })?.enum,
                        toTokenId: ARB_USDC_TOKEN_ITEM.id,
                      },
                    });
                  }
                  onNavigate?.();
                }}
                containerStyle={styles.containerStyle}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  container: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
    alignItems: 'center',
  },

  footer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenSwap: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 36,
  },

  description: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontStyle: 'normal',
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    marginBottom: 24,
    textAlign: 'center',
  },
  accountContainer: {
    marginHorizontal: 5,
    marginBottom: 28,
    alignSelf: 'stretch',
  },

  containerStyle: {
    // width: '100%',
    // height: 40,
    flex: 1,
  },
  buttonStyle: {},
}));
