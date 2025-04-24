import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useTranslation } from 'react-i18next';
import { findChainByServerID } from '@/utils/chain';
import { ellipsisAddress, getAddressScanLink } from '@/utils/address';
import { openExternalUrl } from '@/core/utils/linking';
import { getTokenSymbol } from '@/utils/token';
import { AssetAvatar, Button } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { RcIconExternalLinkCC } from '@/assets/icons/common';
import RcIconWaring from '@/assets2024/icons/swap/waring.svg';

export const useLowCreditState = () => {
  const [lowCreditToken, setLowCreditToken] = useState<TokenItem>();
  const [lowCreditVisible, setLowCreditVisible] = useState(false);

  return {
    lowCreditToken,
    lowCreditVisible,
    setLowCreditToken,
    setLowCreditVisible,
  };
};

interface LowCreditModalProps {
  visible: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  className?: string;
  token?: TokenItem;
}

export const LowCreditModal: React.FC<LowCreditModalProps> = ({
  visible,
  onCancel,
  token,
}) => {
  const { styles, colors, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const openTokenAddress = () => {
    if (token) {
      const scanLink = findChainByServerID(token.chain)?.scanLink;
      if (!scanLink) {
        return;
      }
      openExternalUrl(getAddressScanLink(scanLink, token.id));
    }
  };

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
          <AssetAvatar
            size={40}
            chain={token.chain}
            logo={token.logo_url}
            chainSize={20}
            chainIconPosition="tr"
          />
          <Text style={styles.tokenSymbol}>{getTokenSymbol(token)}</Text>
          <TouchableOpacity
            style={styles.addressContainer}
            onPress={openTokenAddress}>
            <Text style={styles.addressText}>{ellipsisAddress(token.id)}</Text>
            <RcIconExternalLinkCC
              color={colors['neutral-body']}
              width={14}
              height={14}
            />
          </TouchableOpacity>
          <View style={styles.titleWrapper}>
            <RcIconWaring />
            <Text style={styles.title}>
              {t('page.swap.lowCreditModal.title')}
            </Text>
          </View>

          <View style={styles.desc}>
            <Text style={styles.description}>
              {t('page.swap.lowCreditModal.desc')}
            </Text>
          </View>

          <Button
            title={t('global.confirm')}
            onPress={onCancel}
            containerStyle={styles.containerStyle}
            titleStyle={styles.titleStyle}
            buttonStyle={styles.buttonStyle}
          />
        </View>
      </View>
    </Modal>
  );
};

const getStyles = createGetStyles2024(({ colors2024, colors }) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    maxWidth: 352,
    marginHorizontal: 20,
    backgroundColor: colors['neutral-bg1'],
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  iconContainer: {
    marginBottom: 12,
  },

  tokenSymbol: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressText: {
    fontSize: 14,
    color: colors2024['neutral-foot'],
  },
  externalIcon: {
    marginLeft: 8,
    color: colors2024['neutral-body'],
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  desc: {
    marginBottom: 20,
    overflow: 'hidden',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  containerStyle: {
    width: '100%',
    height: 48,
    borderRadius: 100,
  },
  titleStyle: {
    width: '100%',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors['neutral-title-2'],
  },
  buttonStyle: {
    backgroundColor: colors['blue-default'],
    borderRadius: 6,
    width: '100%',
    height: '100%',
  },
}));
