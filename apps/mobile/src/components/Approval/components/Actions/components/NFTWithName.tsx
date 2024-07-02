import {
  NFTItem,
  TransferingNFTItem,
} from '@rabby-wallet/rabby-api/dist/types';
import React from 'react';
import { ellipsisTokenSymbol } from '@/utils/token';
import { TokenLabel } from './Values';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import { Media } from '@/components/Media';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import ModalPreviewNFTItem from '@/components/ModalPreviewNFTItem';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { ModalLayouts } from '@/constant/layout';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      display: 'flex',
    },
    media: {
      width: 18,
      height: 18,
      borderRadius: 2,
      marginRight: 6,
    },
    name: {
      fontWeight: '500',
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title-1'],
      flexShrink: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'row',
    },
  });

const NFTWithName = ({
  nft,
  textStyle,
  showTokenLabel = false,
}: {
  nft: NFTItem;
  textStyle?: StyleProp<TextStyle>;
  showTokenLabel?: boolean;
}) => {
  const [focusingNFT, setFocusingNFT] = React.useState<NFTItem | null>(null);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <>
      <View style={styles.wrapper}>
        <TouchableOpacity
          onPress={event => {
            event.stopPropagation();
            setFocusingNFT(nft);
          }}>
          <Media
            failedPlaceholder={<IconDefaultNFT width="100%" height="100%" />}
            type={nft?.content_type}
            src={nft?.content?.endsWith('.svg') ? '' : nft?.content}
            thumbnail={nft?.content?.endsWith('.svg') ? '' : nft?.content}
            playIconSize={18}
            mediaStyle={styles.media}
            style={styles.media}
          />
        </TouchableOpacity>
        <Text
          style={StyleSheet.flatten([
            styles.name,
            textStyle,
            // showTokenLabel ? {} : { flex: 1 },
          ])}>
          {showTokenLabel
            ? ellipsisTokenSymbol(nft?.name || '-', 15)
            : nft?.name || '-'}
        </Text>
        {showTokenLabel && (
          <View
            style={{
              marginLeft: 4,
            }}>
            <TokenLabel
              isFake={nft.collection?.is_verified === false}
              isScam={
                nft.collection?.is_verified === false
                  ? false
                  : !!nft.collection?.is_suspicious
              }
            />
          </View>
        )}
      </View>
      {focusingNFT && (
        <ModalPreviewNFTItem
          visible={!!focusingNFT}
          nft={focusingNFT as unknown as TransferingNFTItem}
          onDismiss={() => setFocusingNFT(null)}
          snapPoints={[ModalLayouts.defaultHeightPercentText]}
        />
      )}
    </>
  );
};

export default NFTWithName;
