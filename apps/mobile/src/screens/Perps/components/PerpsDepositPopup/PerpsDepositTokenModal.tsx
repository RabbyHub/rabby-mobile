import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, View } from 'react-native';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { AssetAvatar } from '@/components';
import { RcIconSwapArrow } from '@/assets/icons/swap';
import { RcArrowRightCC } from '@/assets2024/icons/perps';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { findChain } from '@/utils/chain';

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
              ? 'Only USDC on Arbitrum is supported for direct deposit. Please swap your current token to USDC before depositing.'
              : 'Only USDC on Arbitrum is supported for direct deposit. Please bridge your current token to USDC on Arbitrum before depositing.'}
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
            <Button
              type="ghost"
              title={t('global.cancel')}
              onPress={onCancel}
              containerStyle={styles.containerStyle}
            />
            <Button
              type="primary"
              title={isSwap ? 'Swap' : 'Bridge'}
              onPress={() => {
                if (isSwap) {
                  // todo account ?
                  navigation.navigate(RootNames.StackTransaction, {
                    screen: RootNames.MultiSwap,

                    params: {
                      swapAgain: true,
                      chainEnum: findChain({ serverId: token.chain })?.enum,
                      swapTokenId: [token._tokenId, arbUsdcToken._tokenId],
                    },
                  });
                } else {
                  // todo account ?
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
    paddingHorizontal: 20,
  },
  container: {
    maxWidth: 352,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },

  footer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
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
    marginTop: 30,
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
    height: 48,
    flex: 1,
  },
  buttonStyle: {},
}));
