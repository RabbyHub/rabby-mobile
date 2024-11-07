import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useTranslation } from 'react-i18next';
import { findChainByServerID } from '@/utils/chain';
import { ellipsisAddress, getAddressScanLink } from '@/utils/address';
import { openExternalUrl } from '@/core/utils/linking';
import { getTokenSymbol } from '@/utils/token';
import { AssetAvatar, Button } from '@/components';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { RcIconExternalLinkCC } from '@/assets/icons/common';

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
  const { styles, colors } = useThemeStyles(getStyles);
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
          <Text style={styles.title}>
            {t('page.swap.lowCreditModal.title')}
          </Text>
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

const getStyles = createGetStyles(colors => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 320,
    backgroundColor: colors['neutral-bg1'],
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 12,
  },

  tokenSymbol: {
    fontSize: 18,
    fontWeight: '500',
    color: colors['neutral-title1'],
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressText: {
    fontSize: 14,
    color: colors['neutral-body'],
  },
  externalIcon: {
    marginLeft: 8,
    color: colors['neutral-body'],
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: colors['neutral-title1'],
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  desc: {
    width: '100%',
    backgroundColor: colors['neutral-card2'],
    height: 52,
    padding: 10,
    paddingRight: 9,
    borderRadius: 6,
    marginBottom: 32,
  },
  description: {
    fontSize: 12,
    fontWeight: '400',
    color: colors['neutral-foot'],
  },
  containerStyle: {
    width: '100%',
    height: 40,
  },
  titleStyle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors['neutral-title-2'],
  },
  buttonStyle: {
    backgroundColor: colors['blue-default'],
    borderRadius: 6,
    width: '100%',
    height: '100%',
  },
}));
