import { useMemo, useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import {
  useInputBlurOnEvents,
  useSendNFTInternalContext,
} from './hooks/useSendNFT';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { Media } from '@/components/Media';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { AddressViewer } from '@/components/AddressViewer';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { NFTAmountInput } from './components/AmountInput';

const getSectionStyles = createGetStyles(colors => {
  return {
    sectionPanel: {
      borderRadius: 8,
      padding: 12,
      backgroundColor: colors['neutral-card1'],
      width: '100%',
    },
  };
});

export function SendNFTSection({
  children,
  style,
}: React.PropsWithChildren<RNViewProps>) {
  const { styles } = useThemeStyles(getSectionStyles);

  return <View style={[styles.sectionPanel, style]}>{children}</View>;
}

export function NFTAmountSection({
  style,
  nftToken,
  collectionName,
}: RNViewProps & {
  nftToken: NFTItem;
  collectionName: string;
}) {
  const { styles } = useThemeStyles(getBalanceStyles);
  const { t } = useTranslation();

  const {
    formValues,
    callbacks: { handleFieldChange },
  } = useSendNFTInternalContext();

  const amountInputRef = useRef<TextInput>(null);
  useInputBlurOnEvents(amountInputRef);

  return (
    <SendNFTSection style={style}>
      <View style={styles.infoSection}>
        <View style={styles.nftMedia}>
          <Media
            failedPlaceholder={<IconDefaultNFT width={'100%'} height={390} />}
            type={nftToken.content_type}
            src={nftToken.content}
            style={styles.images}
            mediaStyle={styles.images}
            playable={true}
            poster={nftToken.content}
          />
        </View>

        {/* right area */}
        <View style={styles.nftDetailBlock}>
          <Text style={styles.nftDetailTitle}>{nftToken.name || '-'}</Text>

          <View style={styles.nftDetailKvs}>
            <View style={[styles.nftDetailLine, { marginTop: 8 }]}>
              <Text style={styles.nftDetaiLabel}>Collection</Text>
              <Text style={[styles.nftDetailText, styles.nftDetailValue]}>
                {collectionName || '-'}
              </Text>
            </View>
            <View style={[styles.nftDetailLine, { marginTop: 8 }]}>
              <Text style={styles.nftDetaiLabel}>Contract</Text>
              <View style={[styles.nftDetailValue, styles.nftDetailCopy]}>
                <AddressViewer
                  address={nftToken.contract_id}
                  showArrow={false}
                />
                <CopyAddressIcon address={nftToken.contract_id} />
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.amountArea}>
        <Text style={styles.amountLabel}>Send amount</Text>
        <NFTAmountInput
          style={styles.nftAmountInput}
          value={formValues.amount}
          onChange={val => {
            handleFieldChange('amount', val + '');
          }}
        />
      </View>
    </SendNFTSection>
  );
}

const BASIC_INFO_H = 72;
const getBalanceStyles = createGetStyles(colors => {
  return {
    balanceText: {
      color: colors['neutral-body'],
      fontSize: 13,
      fontWeight: 'normal',
    },

    infoSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 13,
      marginTop: 0,
    },
    maxButtonWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },

    nftMedia: {
      flexDirection: 'row',
    },
    images: {
      flexShrink: 0,
      height: BASIC_INFO_H,
      width: BASIC_INFO_H,
      borderRadius: 6,
      resizeMode: 'cover',
    },

    nftDetailBlock: {
      flexShrink: 1,
      height: BASIC_INFO_H,
      width: '100%',
      marginLeft: 12,
      position: 'relative',

      justifyContent: 'space-between',
    },

    nftDetailTitle: {
      color: colors['neutral-title1'],
      fontSize: 15,
      fontWeight: '500',
    },

    nftDetailKvs: {},

    nftDetailLine: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    },
    nftDetaiLabel: {
      textAlign: 'left',
      color: colors['neutral-foot'],
      fontSize: 12,
      fontWeight: '400',
    },
    nftDetailText: {
      color: colors['neutral-foot'],
      fontSize: 12,
      fontWeight: '400',
    },
    nftDetailValue: {
      marginLeft: 12,
      textAlign: 'left',
    },
    nftDetailCopy: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    },
    amountArea: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors['neutral-line'],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    amountLabel: {
      color: colors['neutral-body'],
      fontSize: 12,
      fontWeight: '400',
    },
    nftAmountInput: {
      borderColor: colors['neutral-line'],
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 4,
    },
  };
});
