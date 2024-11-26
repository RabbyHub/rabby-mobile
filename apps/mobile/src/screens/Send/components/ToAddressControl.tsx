import React, { useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { NextInput } from '@/components2024/Form/Input';
import EditSVG from '@/assets2024/icons/common/edit-cc.svg';
import WhiteListEnabledCC from '@/assets2024/icons/common/white-list-enable-cc.svg';
import WhiteListDisabledCC from '@/assets2024/icons/common/white-list-disable-cc.svg';
import ScannerCC from '@/assets2024/icons/common/scanner-cc.svg';
import CheckedCC from '@/assets2024/icons/common/checked-cc.svg';
import { useTranslation } from 'react-i18next';
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

export default function ToAddressControl({
  inputProps,
  style,
}: React.PropsWithChildren<
  RNViewProps & {
    inputProps?: React.ComponentProps<typeof NextInput>['inputProps'];
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
      temporaryGrant,
      showWhitelistAlert,
    },
    computed: { whitelistEnabled, toAddressInWhitelist },
    fns: { putScreenState },
    callbacks: { handleFieldChange },
  } = useSendTokenInternalContext();
  const scanner = useScanner();
  const { styles, colors2024 } = useTheme2024({ getStyle });

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

  const CustomIcon = React.useCallback(
    ctx => {
      return (
        <TouchableOpacity
          onPress={openCamera}
          style={StyleSheet.flatten([
            ctx.iconStyle,
            styles.scanButtonContainer,
          ])}>
          <ScannerCC color={colors2024['neutral-title-1']} />
        </TouchableOpacity>
      );
    },
    [colors2024, openCamera, styles.scanButtonContainer],
  );

  const shouldShowWhitelistAlert = formValues.to && showWhitelistAlert;

  const whitelistAlertContent = React.useMemo(() => {
    if (!whitelistEnabled) {
      return {
        content: t('page.sendToken.whitelistAlert__disabled'),
        color: colors2024['neutral-secondary'],
      };
    }
    if (toAddressInWhitelist) {
      return {
        content: t('page.sendToken.whitelistAlert__whitelisted'),
        color: colors2024['neutral-secondary'],
        Icon: CheckedCC,
      };
    }
    if (temporaryGrant) {
      return {
        content: t('page.sendToken.whitelistAlert__temporaryGranted'),
        color: colors2024['neutral-secondary'],
      };
    }

    return {
      content: t('page.sendToken.whitelistAlert__notWhitelisted_tip'),
      color: colors2024['orange-default'],
    };
  }, [colors2024, t, temporaryGrant, toAddressInWhitelist, whitelistEnabled]);

  return (
    <View style={[styles.control, style]}>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>To</Text>
        <View style={styles.titleRight}>
          {showContactInfo && contactInfo?.name && (
            <TouchableOpacity
              style={[
                styles.aliasLabelContainer,
                styles.disabledAliasEditButton,
              ]}
              hitSlop={10}
              disabled={editBtnDisabled}
              onPress={() => {
                putScreenState({ addressToEditAlias: formValues.to });
              }}>
              <Text
                style={styles.aliasLabel}
                numberOfLines={1}
                ellipsizeMode="tail">
                {contactInfo?.name}
              </Text>
              <EditSVG
                style={styles.aliasEditIcon}
                color={colors2024['brand-default']}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.entryWhitelist}
            onPress={() => {
              putScreenState({
                showListContactModal: true,
              });
            }}>
            {whitelistEnabled ? (
              <WhiteListEnabledCC color={colors2024['neutral-body']} />
            ) : (
              <WhiteListDisabledCC color={colors2024['neutral-body']} />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <NextInput
        containerStyle={[
          styles.inputContainer,
          errors.to ? styles.inputContainerError : {},
        ]}
        ref={formInputRef}
        disableFocusingStyle
        inputStyle={[styles.input, !formValues.to && styles.inputWithoutValue]}
        hasError={!!errors.to}
        clearable={false}
        customIcon={CustomIcon}
        inputProps={{
          ...inputProps,
          multiline: true,
          value: formValues.to,
          onChangeText: value => {
            handleFieldChange('to', value);
          },
          onBlur: formik.handleBlur('to'),
          placeholder: 'Enter an address or search',
          placeholderTextColor: colors2024['neutral-info'],
          style: {
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      />
      {/* extra info area */}

      <View style={styles.extraView}>
        {errors.to ? (
          <Text style={styles.tip}>{errors.to}</Text>
        ) : shouldShowWhitelistAlert ? (
          <>
            <Text
              style={StyleSheet.flatten([
                styles.tip,
                { color: whitelistAlertContent.color },
              ])}>
              {whitelistAlertContent.content}
            </Text>
            {whitelistAlertContent.Icon && <whitelistAlertContent.Icon />}
          </>
        ) : null}
      </View>

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

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    control: {
      width: '100%',
      marginBottom: 16,
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
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },

    aliasLabelContainer: {
      borderRadius: 100,
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'solid',
      borderColor: colors2024['brand-light-1'],
      backgroundColor: colors2024['brand-light-1'],
      paddingHorizontal: 8,
      paddingVertical: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },

    disabledAliasEditButton: {},

    aliasEditIcon: {},

    aliasLabel: {
      color: colors2024['brand-default'],
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },

    entryWhitelist: {
      marginLeft: 8,
    },

    inputContainer: {
      borderRadius: 30,
      flexShrink: 0,
      paddingHorizontal: 24,
      paddingVertical: 20,
      width: '100%',
      marginTop: 12,
      backgroundColor: colors2024['neutral-bg-2'],
      alignItems: 'flex-start',
      height: 'auto',
      borderColor: colors2024['neutral-bg-2'],
    },

    inputContainerError: {
      borderColor: colors2024['red-default'],
    },

    input: {
      color: colors2024['neutral-title-1'],
      paddingHorizontal: 0,
      fontSize: 16,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      marginRight: 12,
    },

    inputWithoutValue: {
      fontWeight: '400',
    },

    scanButtonContainer: {
      marginRight: 24,
    },

    extraView: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 26,
      paddingTop: 8,
    },

    tip: {
      color: colors2024['red-default'],
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },

    tipNoContact: {
      color: colors2024['neutral-title1'],
      fontSize: 12,
      fontWeight: 'normal',
      paddingTop: 12,
      flexDirection: 'row',
      alignItems: 'baseline',
    },

    textAddToContact: {
      color: colors2024['blue-default'],
      textDecorationLine: 'underline',
      marginLeft: 2,
      fontSize: 12,
    },
  };
});
