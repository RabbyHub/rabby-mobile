import { useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import TouchableView from '@/components/Touchable/TouchableView';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { FormInput } from '@/components/Form/Input';
import {
  RcWhiteListEnabled,
  RcWhiteListDisabled,
} from '@/assets/icons/address';

import RcEditPenCC from '../icons/edit-pen-cc.svg';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { Trans, useTranslation } from 'react-i18next';
import {
  useInputBlurOnEvents,
  useSendTokenFormik,
  useSendTokenInternalContext,
} from '../hooks/useSendToken';
import { SelectAddressSheetModal } from '@/components/SelectAddress/SelectAddressSheetModal';
import { ModalEditContact } from './SheetModalEditContact';

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
    events,
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
  const styles = getStyles(colors);

  const { t } = useTranslation();

  const { errors } = useSendTokenFormik();

  const formInputRef = useRef<TextInput>(null);
  useInputBlurOnEvents(formInputRef);

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
          placeholder: 'Enter address',
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
    </View>
  );
}

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

    inputContainer: {
      borderRadius: 4,

      width: '100%',
      height: 64,
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
