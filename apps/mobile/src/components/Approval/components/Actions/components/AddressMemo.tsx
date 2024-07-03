import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextStyle,
} from 'react-native';
import { BottomSheetInput } from '@/components/Input';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useAlias } from '@/hooks/alias';
import IconEdit from '@/assets/icons/approval/editpen.svg';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';
import { FooterButtonGroup } from '@/components/FooterButton/FooterButtonGroup';
import { useApprovalAlias } from '@/components/Approval/hooks/useApprovalAlias';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    mainView: {
      backgroundColor: colors['neutral-bg-1'],
      paddingBottom: 20,
    },
    inputView: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
  });

const AddressMemo = ({
  address,
  textStyle,
}: {
  address: string;
  textStyle?: TextStyle;
}) => {
  const alias = useApprovalAlias();
  const addressAlias = alias.accountMap[address]?.alias;
  const [visible, setVisible] = useState(false);
  const [inputText, setInputText] = useState(addressAlias || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [canSubmit, setCanSubmit] = useState(false);
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const commonStyle = useCommonStyle();

  const handleConfirm = () => {
    if (!inputText) {
      setErrorMessage('Please input address note');
    }
    alias.update(address, inputText);
    setVisible(false);
  };

  const handleEditMemo = () => {
    setVisible(true);
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
  };

  useEffect(() => {
    alias.add(address);
  }, [address, alias]);

  useEffect(() => {
    setInputText(addressAlias || '');
  }, [addressAlias]);

  React.useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  useEffect(() => {
    if (!inputText) {
      setCanSubmit(false);
    } else {
      setCanSubmit(true);
    }
  }, [inputText]);

  return (
    <View>
      <TouchableOpacity onPress={handleEditMemo}>
        <View style={commonStyle.rowFlexCenterItem}>
          <Text className="mr-[2]" style={textStyle}>
            {addressAlias || '-'}
          </Text>
          <IconEdit className="w-[13px]" />
        </View>
      </TouchableOpacity>
      <AppBottomSheetModal
        ref={modalRef}
        onDismiss={() => setVisible(false)}
        keyboardBlurBehavior="restore"
        snapPoints={[300]}>
        <BottomSheetView style={styles.mainView}>
          <AppBottomSheetModalTitle
            title={t('component.Contact.EditModal.title')}
          />
          <View style={styles.inputView}>
            <BottomSheetInput
              onChangeText={handleTextChange}
              maxLength={50}
              // autoFocus
              value={inputText}
              placeholder="Please input address note"
            />
            <Text className="mt-[10] text-r-red-default">{errorMessage}</Text>
          </View>
          <FooterButtonGroup
            onCancel={() => setVisible(false)}
            onConfirm={handleConfirm}
          />
        </BottomSheetView>
      </AppBottomSheetModal>
    </View>
  );
};

export default AddressMemo;
