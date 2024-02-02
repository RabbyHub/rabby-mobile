import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { SpenderPopup, SpenderPopupProps } from './ViewMorePopup/SpenderPopup';
import {
  ContractPopup,
  ContractPopupProps,
} from './ViewMorePopup/ContractPopup';
import {
  ReceiverPopup,
  ReceiverPopupProps,
} from './ViewMorePopup/ReceiverPopup';
import { NFTPopupProps, NFTPopup } from './ViewMorePopup/NFTPopup';
import {
  CollectionPopup,
  CollectionPopupProps,
} from './ViewMorePopup/CollectionPopup';
import {
  NFTSpenderPopup,
  NFTSpenderPopupProps,
} from './ViewMorePopup/NFTSpenderPopup';
import { useTranslation } from 'react-i18next';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';

type Props =
  | SpenderPopupProps
  | NFTSpenderPopupProps
  | ContractPopupProps
  | ReceiverPopupProps
  | NFTPopupProps
  | CollectionPopupProps;

export const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    mainView: {
      paddingHorizontal: 20,
      paddingTop: 20,
      backgroundColor: colors['neutral-bg-1'],
      height: '100%',
    },
    popupContainer: {},
    title: {
      flexDirection: 'row',
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
    },
    titleText: {
      fontSize: 16,
      lineHeight: 19,
      color: colors['neutral-title-1'],
      marginRight: 6,
    },
    valueAddress: {
      fontWeight: '500',
      marginLeft: 7,
    },
    viewMoreTable: {},
    row: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      fontSize: 15,
    },
    firstRow: {
      maxWidth: 140,
      borderRightWidth: 0.5,
      borderRightColor: colors['neutral-line'],
      backgroundColor: colors['neutral-card-3'],
      flexShrink: 0,
    },
  });

const ViewMore = (props: Props) => {
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const commonStyle = useCommonStyle();

  const handleClickViewMore = () => {
    setPopupVisible(true);
  };

  const height = React.useMemo(() => {
    switch (props.type) {
      case 'contract':
        return 380;
      case 'spender':
      case 'nftSpender':
        return 475;
      case 'receiver':
        return 450;
      case 'nft':
        return 250;
      case 'collection':
        return 200;
      default:
        return 420;
    }
  }, [props.type]);

  React.useEffect(() => {
    if (!popupVisible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [popupVisible]);

  return (
    <>
      <Text
        style={{
          ...commonStyle.secondaryText,
          textDecorationLine: 'underline',
        }}
        onPress={handleClickViewMore}>
        {t('page.approvals.component.ViewMore.text')}
      </Text>
      <AppBottomSheetModal
        ref={modalRef}
        onDismiss={() => setPopupVisible(false)}
        snapPoints={[height]}>
        <BottomSheetView style={styles.mainView}>
          <View style={styles.popupContainer}>
            {props.type === 'contract' && <ContractPopup data={props.data} />}
            {props.type === 'spender' && <SpenderPopup data={props.data} />}
            {props.type === 'nftSpender' && (
              <NFTSpenderPopup data={props.data} />
            )}
            {props.type === 'receiver' && <ReceiverPopup data={props.data} />}
            {props.type === 'nft' && <NFTPopup data={props.data} />}
            {props.type === 'collection' && (
              <CollectionPopup data={props.data} />
            )}
          </View>
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
};

export default ViewMore;
