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
import { Button } from '@/components/Button';
import { useAlias } from '@/hooks/alias';
import IconEdit from '@/assets/icons/approval/editpen.svg';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    mainView: {
      paddingHorizontal: 20,
      backgroundColor: colors['neutral-bg-1'],
      height: '100%',
    },
  });

const AddressMemo = ({
  address,
  textStyle,
}: {
  address: string;
  textStyle?: TextStyle;
}) => {
  const [addressAlias, updateAlias] = useAlias(address);
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
    updateAlias(inputText);
    setVisible(false);
  };

  const handleEditMemo = () => {
    setVisible(true);
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
  };

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
        snapPoints={['30%']}>
        <BottomSheetView style={styles.mainView}>
          <AppBottomSheetModalTitle
            title={t('component.Contact.EditModal.title')}
          />
          <View className="pt-[4px]">
            <BottomSheetInput
              onChangeText={handleTextChange}
              maxLength={50}
              autoFocus
              value={inputText}
              placeholder="Please input address note"
            />
            <Text className="mt-[10] text-r-red-default">{errorMessage}</Text>
            <View className="flex flex-row justify-center mt-[40]">
              <Button
                buttonStyle={{
                  width: 200,
                  backgroundColor: colors['blue-default'],
                  height: 44,
                  padding: 10,
                }}
                titleStyle={{
                  color: '#fff',
                  fontSize: 15,
                }}
                disabled={!canSubmit}
                onPress={handleConfirm}
                title={t('global.confirm')}
              />
            </View>
          </View>
        </BottomSheetView>
      </AppBottomSheetModal>
    </View>
  );
};

export default AddressMemo;
