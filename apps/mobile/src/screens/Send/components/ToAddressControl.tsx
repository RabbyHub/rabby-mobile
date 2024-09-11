import React, { useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import TouchableView from '@/components/Touchable/TouchableView';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { FormInput } from '@/components/Form/Input';
import {
  RcWhiteListEnabled,
  RcWhiteListDisabled,
  RcIconInnerScanner,
} from '@/assets/icons/address';

import { RcEditPenCC } from '@/assets/icons/send';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { Trans, useTranslation } from 'react-i18next';
import {
  useInputBlurOnEvents,
  useSendTokenFormik,
  useSendTokenInternalContext,
} from '../hooks/useSendToken';
import { SelectAddressSheetModal } from '@/components/Address/SelectAddressSheetModal';
import { ModalEditContact } from '@/components/Address/SheetModalEditContact';
import { CameraPopup } from '@/screens/Address/components/CameraPopup';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { isValidHexAddress } from '@metamask/utils';
import { Code } from 'react-native-vision-camera';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { useScanner } from '@/screens/Scanner/ScannerScreen';

const RcEditPen = makeThemeIconFromCC(RcEditPenCC, 'blue-default');

export default function ToAddressControl({
  inputProps,
  style,
}: React.PropsWithChildren<
  RNViewProps & {
    inputProps?: React.ComponentProps<typeof FormInput>['inputProps'];
  }
>) {
  const {
    formik,
    formValues,
    screenState: {
      showListContactModal,
      addressToEditAlias,
      editBtnDisabled,
      showContactInfo,
      contactInfo,
    },
    computed: { toAddressIsValid, toAddressInContactBook, whitelistEnabled },
    fns: { putScreenState },
    callbacks: { handleFieldChange },
  } = useSendTokenInternalContext();
  const colors = useThemeColors();
  const scanner = useScanner();

  const styles = getStyles(colors);

  const { t } = useTranslation();

  const { errors } = useSendTokenFormik();

  const formInputRef = useRef<TextInput>(null);
  useInputBlurOnEvents(formInputRef);

  const codeRef = useRef<BottomSheetModal>(null);
  const openCamera = React.useCallback(() => {
    navigate(RootNames.Scanner);
  }, []);

  React.useEffect(() => {
    if (scanner.text) {
      handleFieldChange('to', scanner.text);
      scanner.clear();
    }
  }, [handleFieldChange, scanner]);

  const onCodeScanned = React.useCallback(
    (codes: Code[]) => {
      if (
        codes[0].value &&
        isValidHexAddress(codes[0].value as `0x${string}`)
      ) {
        codeRef.current?.close();
        handleFieldChange('to', codes[0].value);
      }
    },
    [handleFieldChange],
  );

  return (
    <View style={[styles.control, style]}>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>To</Text>
        <View style={styles.titleRight}>
          {showContactInfo && contactInfo?.name && (
            <TouchableView
              style={[
                styles.aliasLabelContainer,
                styles.disabledAliasEditButton,
              ]}
              disabled={editBtnDisabled}
              onPress={() => {
                putScreenState({ addressToEditAlias: formValues.to });
              }}>
              <RcEditPen style={styles.aliasEditIcon} />
              <Text
                style={styles.aliasLabel}
                numberOfLines={1}
                ellipsizeMode="tail">
                {contactInfo?.name}
              </Text>
            </TouchableView>
          )}

          <TouchableView
            style={styles.entryWhitelist}
            onPress={() => {
              putScreenState({
                showListContactModal: true,
              });
            }}>
            {whitelistEnabled ? (
              <RcWhiteListEnabled style={styles.entryWhitelistIcon} />
            ) : (
              <RcWhiteListDisabled style={styles.entryWhitelistIcon} />
            )}
          </TouchableView>
        </View>
      </View>
      <FormInput
        className="mt-[8]"
        containerStyle={styles.inputContainer}
        ref={formInputRef}
        disableFocusingStyle
        inputStyle={styles.input}
        hasError={!!errors.to}
        clearable={false}
        customIcon={ctx => {
          return (
            <TouchableView
              onPress={openCamera}
              style={StyleSheet.flatten([
                ctx.iconStyle,
                styles.scanButtonContainer,
              ])}>
              <RcIconInnerScanner style={styles.scanIcon} />
            </TouchableView>
          );
        }}
        inputProps={{
          ...inputProps,
          numberOfLines: 2,
          multiline: true,
          value: formValues.to,
          onChangeText: value => {
            handleFieldChange('to', value);
          },
          onBlur: formik.handleBlur('to'),
          // placeholder: t('page.sendToken.sectionTo.searchInputPlaceholder'),
          placeholder: 'Enter address or search',
          placeholderTextColor: colors['neutral-foot'],
        }}
      />
      {/* extra info area */}
      {errors.to ? (
        <View style={styles.extraView}>
          <Text style={styles.tipError}>{errors.to}</Text>
        </View>
      ) : (
        toAddressIsValid &&
        !toAddressInContactBook && (
          <TouchableView
            onPress={() => {
              putScreenState({ addressToAddAsContacts: formValues.to });
            }}
            style={styles.extraView}>
            <Text style={styles.tipNoContact}>
              <Trans i18nKey="page.sendToken.addressNotInContract" t={t}>
                Not on address list.{' '}
                <Text style={styles.textAddToContact}>Add to contacts</Text>
              </Trans>
            </Text>
          </TouchableView>
        )
      )}

      <ModalEditContact
        address={addressToEditAlias || ''}
        onOk={result => {
          putScreenState({
            addressToEditAlias: null,
            contactInfo: result,
          });
        }}
        onCancel={() => {
          putScreenState({ addressToEditAlias: null });
        }}
      />

      <SelectAddressSheetModal
        visible={showListContactModal}
        onConfirm={contact => {
          handleFieldChange('to', contact.address);
          putScreenState({
            showListContactModal: false,
          });
        }}
        onClose={() => {
          putScreenState({
            showListContactModal: false,
          });
        }}
      />
      <CameraPopup ref={codeRef} onCodeScanned={onCodeScanned} />
    </View>
  );
}

const SIZES = {
  INPUT_CONTAINER_H: 64,
  SCAN_BTN_H: 64,
  SCAN_BTN_W: 32,
  SCAN_ICON_SIZE: 20,
};

const getStyles = createGetStyles(colors => {
  return {
    control: {
      width: '100%',
    },

    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titleRight: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      maxWidth: '70%',
    },

    sectionTitle: {
      color: colors['neutral-body'],
      fontSize: 13,
      fontWeight: 'normal',
    },

    aliasLabelContainer: {
      borderRadius: 2,
      // borderWidth: 0.5,
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'solid',
      borderColor: colors['blue-default'],

      paddingHorizontal: 8,
      height: '100%',
      minHeight: 20,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },

    disabledAliasEditButton: {},

    aliasEditIcon: {
      width: 14,
      height: 14,
      marginRight: 2,
    },

    aliasLabel: {
      color: colors['blue-default'],
      fontSize: 12,
      fontWeight: 'normal',
      maxWidth: '100%',
    },

    entryWhitelist: {
      marginLeft: 8,
      paddingLeft: 8,
    },

    entryWhitelistIcon: {
      width: 20,
      height: 20,
    },

    inputWrapper: {
      position: 'relative',
      paddingRight: SIZES.INPUT_CONTAINER_H - 12,
      // ...makeDebugBorder('red'),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },

    inputContainer: {
      borderRadius: 4,
      flexShrink: 0,
      // ...makeDebugBorder('yellow'),

      width: '100%',
      height: SIZES.INPUT_CONTAINER_H,
    },

    input: {
      color: colors['neutral-title1'],
      width: '100%',
      paddingRight: 8,
      // ...makeDebugBorder('red'),
      // paddingTop: Platform.OS === 'ios' ? 12 : 0,
      paddingTop: 12,
      paddingHorizontal: 12,
      // flexDirection: 'row',
      // alignItems: 'center',
    },

    scanButtonContainer: {
      flexShrink: 0,
      width: SIZES.SCAN_BTN_W,
      height: SIZES.SCAN_BTN_H,
      // ...makeDebugBorder('blue'),
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: 8,
    },

    scanIcon: {
      width: SIZES.SCAN_ICON_SIZE,
      height: SIZES.SCAN_ICON_SIZE,
      color: colors['neutral-title1'],
    },

    extraView: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },

    tipError: {
      color: colors['red-default'],
      fontSize: 13,
      fontWeight: 'normal',
      paddingTop: 12,
    },

    tipNoContact: {
      color: colors['neutral-title1'],
      fontSize: 12,
      fontWeight: 'normal',
      paddingTop: 12,
      flexDirection: 'row',
      alignItems: 'baseline',
    },

    textAddToContact: {
      color: colors['blue-default'],
      textDecorationLine: 'underline',
      marginLeft: 2,
      fontSize: 12,
    },
  };
});
