import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
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
import { getStyle } from './getStyle';
import { useThemeColors } from '@/hooks/theme';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';

type Props =
  | SpenderPopupProps
  | NFTSpenderPopupProps
  | ContractPopupProps
  | ReceiverPopupProps
  | NFTPopupProps
  | CollectionPopupProps;

const ViewMore = (
  props: Props & {
    children?: React.ReactNode;
  },
) => {
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
        return 350;
      case 'spender':
      case 'nftSpender':
        return 405;
      case 'receiver':
        return 380;
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
      {props.children ? (
        <TouchableOpacity onPress={handleClickViewMore}>
          {props.children}
        </TouchableOpacity>
      ) : (
        <Text
          style={StyleSheet.flatten({
            ...commonStyle.secondaryText,
            textDecorationLine: 'underline',
          })}
          onPress={handleClickViewMore}>
          {t('page.approvals.component.ViewMore.text')}
        </Text>
      )}
      <AppBottomSheetModal
        ref={modalRef}
        onDismiss={() => setPopupVisible(false)}
        handleStyle={styles.handle}
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
