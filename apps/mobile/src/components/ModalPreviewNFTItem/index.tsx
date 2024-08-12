import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TransferingNFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { getChain } from '@/utils/chain';
import { Media } from '../Media';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { StyleSheet, Text, View } from 'react-native';
import { abbreviateNumber } from '@/utils/math';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { splitNumberByStep } from '@/utils/number';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      padding: 20,
    },
    corner: {
      backgroundColor: colors['neutral-black'],
      position: 'absolute',
      right: 4,
      top: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 2,
      alignItems: 'center',
      opacity: 0.8,
    },
    cornerNumber: {
      color: colors['neutral-title-2'],
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 14,
    },
    nft: {
      position: 'relative',
      height: 306,
    },
    media: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
    },
    nftAvatar: {
      width: '100%',
      height: 300,
      borderRadius: 6,
      backgroundColor: colors['neutral-bg-1'],
    },
    nftTitle: {
      fontWeight: '500',
      fontSize: 18,
      lineHeight: 20,
      color: colors['neutral-title1'],
      overflow: 'hidden',
    },
    nftTitleWrapper: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors['neutral-line'],
      borderStyle: 'solid',
      paddingTop: 16,
      paddingBottom: 16,
    },
    nftProperties: {
      paddingTop: 12,
      marginBottom: 16,
    },
    nftProperty: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      flexDirection: 'row',
    },
    nftPropertyLabel: {
      fontWeight: '400',
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title1'],
    },
    nftPropertyValue: {
      overflow: 'hidden',
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      color: colors['neutral-title1'],
    },
  });

export default function ModalPreviewNFTItem({
  nft,
  visible,
  ...props
}: { nft: TransferingNFTItem; visible: boolean } & Omit<
  React.ComponentProps<typeof BottomSheetModal>,
  'children'
>) {
  const modalRef = React.useRef<AppBottomSheetModal>(null);

  React.useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  const numberDisplay = useMemo(() => {
    let v = abbreviateNumber(nft.amount || 0);
    if (v?.endsWith('T')) {
      let tmp = v.slice(0, -1);
      if (Number(tmp) > 999) {
        v += '+';
      }
    }
    return v;
  }, [nft.amount]);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const collectProperty = nft?.collection;
  const { chainName } = React.useMemo(() => {
    const chainName = getChain(nft?.chain)?.name || '-';
    return { chainName };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectProperty]);

  const { t } = useTranslation();

  return (
    <AppBottomSheetModal enableDynamicSizing ref={modalRef} {...props}>
      <BottomSheetView style={styles.wrapper}>
        <View style={styles.nft}>
          <Media
            failedPlaceholder={<IconDefaultNFT width="100%" height="100%" />}
            type={nft?.content_type}
            src={nft?.content?.endsWith('.svg') ? '' : nft?.content}
            thumbnail={nft?.content?.endsWith('.svg') ? '' : nft?.content}
            style={styles.media}
            mediaStyle={styles.media}
          />
          {nft?.amount > 1 ? (
            <View style={styles.corner}>
              <Text style={styles.cornerNumber}>{numberDisplay}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.nftTitleWrapper}>
          <Text numberOfLines={1} style={styles.nftTitle}>
            {nft?.name || '-'}
          </Text>
        </View>
        <View style={styles.nftProperties}>
          <View style={styles.nftProperty}>
            <Text style={styles.nftPropertyLabel}>
              {t('component.ModalPreviewNFTItem.FieldLabel.Collection')}
            </Text>
            <Text style={styles.nftPropertyValue}>
              {collectProperty?.name || '-'}
            </Text>
          </View>
          <View style={styles.nftProperty}>
            <Text style={styles.nftPropertyLabel}>
              {t('component.ModalPreviewNFTItem.FieldLabel.Chain')}
            </Text>
            <Text style={styles.nftPropertyValue}>{chainName}</Text>
          </View>
          <View style={styles.nftProperty}>
            <Text style={styles.nftPropertyLabel}>
              {t('component.ModalPreviewNFTItem.FieldLabel.PurschaseDate')}
            </Text>
            <Text style={styles.nftPropertyValue}>
              {(nft as any)?.pay_token?.date_at || '-'}
            </Text>
          </View>
          <View style={styles.nftProperty}>
            <Text style={styles.nftPropertyLabel}>
              {t('component.ModalPreviewNFTItem.FieldLabel.LastPrice')}
            </Text>
            <Text style={styles.nftPropertyValue}>
              {(nft as any)?.usd_price
                ? `$${splitNumberByStep(
                    ((nft as any)?.usd_price || 0).toFixed(2),
                  )}`
                : '-'}
            </Text>
          </View>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}
