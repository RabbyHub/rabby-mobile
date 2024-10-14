import React, { useRef, useCallback, useEffect } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

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

  const openCamera = useCallback(() => {
    navigate(RootNames.Scanner);
  }, []);

  useEffect(() => {
    if (scanner.text) {
      handleFieldChange('to', scanner.text);
      scanner.clear();
    }
  }, [handleFieldChange, scanner]);

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
        containerStyle={[
          styles.inputContainer,
          !formValues.to && styles.withoutValue,
        ]}
        ref={formInputRef}
        disableFocusingStyle
        inputStyle={styles.input}
        hasError={!!errors.to}
        clearable={false}
        customIcon={ctx => {
          if (formValues.to) {
            return null;
          }
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
          multiline: true,
          value: formValues.to,
          onChangeText: value => {
            handleFieldChange('to', value);
          },
          onBlur: formik.handleBlur('to'),
          // placeholder: t('page.sendToken.sectionTo.searchInputPlaceholder'),
          placeholder: 'Enter address or search',
          placeholderTextColor: colors['neutral-foot'],
          style: {
            paddingTop: 0,
            paddingBottom: 0,
          },
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
    </View>
  );
}

const SIZES = {
  INPUT_CONTAINER_H: 60,
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
      // ...makeDebugBorder(),
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
    },

    entryWhitelistIcon: {
      width: 20,
      height: 20,
    },

    inputContainer: {
      height: SIZES.INPUT_CONTAINER_H,
      borderRadius: 4,
      flexShrink: 0,
      // ...makeDebugBorder('yellow'),
      paddingVertical: 12,
      width: '100%',
      marginTop: 8,
    },

    withoutValue: {
      height: 'auto',
      // paddingVertical: 24,
    },

    input: {
      color: colors['neutral-title1'],
      width: '100%',
      paddingRight: 8,
      // ...makeDebugBorder('red'),
      paddingTop: 12,
      paddingHorizontal: 12,
      fontSize: 15,
      fontWeight: '600',
    },

    scanButtonContainer: {
      flexShrink: 0,
      // ...makeDebugBorder('blue'),
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: 12,
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
