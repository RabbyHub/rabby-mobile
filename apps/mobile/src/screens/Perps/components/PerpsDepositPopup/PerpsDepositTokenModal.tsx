import { RcArrowRightCC } from '@/assets2024/icons/perps';
import { AssetAvatar } from '@/components';
import { Button } from '@/components2024/Button';
import { RootNames } from '@/constant/layout';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePerpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  token?: AbstractPortfolioToken | null;
  arbUsdcToken?: AbstractPortfolioToken | null;
  onCancel?: () => void;
  onNavigate?: () => void;
}

export const PerpsDepositTokenModal: React.FC<Props> = ({
  visible,
  onCancel,
  onNavigate,
  token,
  arbUsdcToken,
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const isSwap = token?.chain === arbUsdcToken?.chain;
  const navigation = useRabbyAppNavigation();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { state } = usePerpsStore();

  if (!token || !arbUsdcToken) {
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
              chain={arbUsdcToken.chain}
              logo={arbUsdcToken.logo_url}
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
                    navigation.navigate(RootNames.StackTransaction, {
                      screen: RootNames.MultiSwap,

                      params: {
                        swapAgain: true,
                        chainEnum: findChain({ serverId: token.chain })?.enum,
                        swapTokenId: [token._tokenId, arbUsdcToken._tokenId],
                      },
                    });
                  } else {
                    navigation.navigate(RootNames.StackTransaction, {
                      screen: RootNames.MultiBridge,

                      params: {
                        chainEnum: findChain({ serverId: token.chain })?.enum,
                        tokenId: token._tokenId,
                        toChainEnum: findChain({ serverId: arbUsdcToken.chain })
                          ?.enum,
                        toTokenId: arbUsdcToken._tokenId,
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
