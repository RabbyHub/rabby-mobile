import React, { useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useThemeStyles, useTheme2024 } from '@/hooks/theme';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { Chain } from '@/constant/chains';
import {
  useSendNFTInternalContext,
  useInputBlurOnEvents,
} from './hooks/useSendNFT';
import { NFTAmountInput } from './components/AmountInput';
import { Media } from '@/components/Media';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { AddressViewer } from '@/components/AddressViewer';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { AddressItemShadowView } from '../Address/components/AddressItemShadowView';

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

export function NFTSection({
  style,
  nftItem,
  collectionName,
  chainItem,
}: RNViewProps & {
  nftItem: NFTItem;
  collectionName?: string;
  chainItem?: Chain;
}) {
  const { styles } = useTheme2024({ getStyle: getNFTSectionStyles });
  const { t } = useTranslation();

  const {
    formValues,
    callbacks: { handleFieldChange },
  } = useSendNFTInternalContext();

  const amountInputRef = useRef<TextInput>(null);
  useInputBlurOnEvents(amountInputRef);

  return (
    <View style={[styles.nftSection, style]}>
      <View style={styles.titleSection}>
        <Text style={styles.sectionTitle}>{t('page.sendNFT.NFT')}</Text>
      </View>
      <AddressItemShadowView>
        <View style={styles.nftContainer}>
          <Text style={styles.nftDetailTitle}>{nftItem.name || '-'}</Text>
          <View style={styles.infoSection}>
            <View style={styles.nftMedia}>
              <Media
                failedPlaceholder={
                  <IconDefaultNFT width={'100%'} height={BASIC_INFO_H} />
                }
                type={nftItem.content_type}
                src={nftItem.content}
                style={styles.images}
                mediaStyle={styles.images}
                playable={true}
                poster={nftItem.content}
              />
            </View>

            {/* right area */}
            <View style={styles.nftDetailBlock}>
              <View style={styles.nftDetailKvs}>
                <View style={[styles.nftDetailLine]}>
                  <Text style={styles.nftDetaiLabel}>
                    {t('page.sendNFT.Collection')}
                  </Text>
                  <Text style={[styles.nftDetailText, styles.nftDetailValue]}>
                    {collectionName || '-'}
                  </Text>
                </View>
                <View style={[styles.nftDetailLine]}>
                  <Text style={styles.nftDetaiLabel}>
                    {t('page.sendNFT.Chain')}
                  </Text>
                  <View style={styles.chainInfo}>
                    <ChainIconImage size={16} chainEnum={chainItem?.enum} />
                    <Text style={[styles.nftDetailValue, styles.chainName]}>
                      {chainItem?.name}
                    </Text>
                  </View>
                </View>
                <View style={[styles.nftDetailLine]}>
                  <Text style={styles.nftDetaiLabel}>
                    {t('page.sendNFT.Contract')}
                  </Text>
                  <View style={[styles.nftDetailValue, styles.nftDetailCopy]}>
                    <AddressViewer
                      address={nftItem.contract_id}
                      showArrow={false}
                      addressStyle={[styles.nftDetailText]}
                    />
                    <CopyAddressIcon address={nftItem.contract_id} />
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.amountArea}>
            <Text style={styles.amountLabel}>
              {t('page.sendNFT.SendAmount')}
            </Text>
            <NFTAmountInput
              nftItem={nftItem}
              style={styles.nftAmountInput}
              value={formValues.amount}
              onChange={val => {
                handleFieldChange('amount', val + '');
              }}
            />
          </View>
        </View>
      </AddressItemShadowView>
    </View>
  );
}

const BASIC_INFO_H = 80;
const getNFTSectionStyles = createGetStyles2024(({ colors2024 }) => {
  return {
    nftSection: {
      width: '100%',
      gap: 12,
    },
    titleSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    nftContainer: {
      paddingHorizontal: 22,
      paddingVertical: 16,
      width: '100%',
    },
    infoSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 14,
      marginTop: 10,
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
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
    },
    nftDetailKvs: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    },
    nftDetailLine: {
      paddingVertical: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    nftDetaiLabel: {
      textAlign: 'left',
      color: colors2024['neutral-secondary'],
      fontSize: 14,
      fontWeight: '500',
      width: 70,
    },
    chainInfo: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    },
    nftDetailValue: {},
    chainName: {
      marginLeft: 6,
      fontSize: 12,
      color: colors2024['neutral-body'],
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    nftDetailText: {
      color: colors2024['neutral-body'],
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    nftDetailCopy: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      fontSize: 14,
      color: colors2024['neutral-foot'],
    },
    amountArea: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors2024['neutral-line'],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    amountLabel: {
      color: colors2024['neutral-secondary'],
      fontSize: 14,
      fontWeight: '500',
    },
    nftAmountInput: {
      borderColor: colors2024['neutral-bg-2'],
      backgroundColor: colors2024['neutral-bg-2'],
      color: colors2024['neutral-title-1'],
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 4,
    },
  };
});
