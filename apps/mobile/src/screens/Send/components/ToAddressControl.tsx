import { StyleSheet, Text, View } from 'react-native';

import TouchableView from '@/components/Touchable/TouchableView';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { FormInput } from '@/components/Form/Input';
import { RcWhiteList } from '@/assets/icons/address';

import RcEditPenCC from '../icons/edit-pen-cc.svg';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { Trans, useTranslation } from 'react-i18next';
import {
  useSendTokenFormik,
  useSendTokenInternalContext,
} from '../hooks/useSendToken';
import { SelectAddressSheetModal } from '@/components/SelectAddress/SelectAddressSheetModal';

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
    screenState: { showListContactModal },
    computed: { toAddressIsValid, toAddressInContactBook, toAliasName },
    fns: { putScreenState },
    callbacks: { handleFieldChange },
  } = useSendTokenInternalContext();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { t } = useTranslation();

  const { errors } = useSendTokenFormik();

  return (
    <View style={[styles.control, style]}>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>To</Text>
        <View style={styles.titleRight}>
          {toAliasName && (
            <TouchableView
              style={styles.commentLabelContainer}
              /* TODO: impl address note */
              onPress={() => {}}>
              <RcEditPen className="w-[14] h-[14] mr-[2]" />
              {/* ellipse it */}
              <Text style={styles.commentLabel}>{toAliasName}</Text>
            </TouchableView>
          )}

          <TouchableView
            className="ml-[8] pl-[12]"
            onPress={() => {
              putScreenState({
                showListContactModal: true,
              });
            }}>
            <RcWhiteList className="w-[20] h-[20]" />
          </TouchableView>
        </View>
      </View>
      <FormInput
        className="mt-[8]"
        containerStyle={styles.inputContainer}
        inputStyle={styles.input}
        hasError={!!errors.to}
        inputProps={{
          ...inputProps,
          value: formValues.to,
          onChangeText: value => {
            handleFieldChange('to', value);
          },
          onBlur: formik.handleBlur('to'),
          placeholder: 'Enter address or search',
          placeholderTextColor: colors['neutral-foot'],
        }}
      />
      {/* extra info area */}
      <View style={styles.extraView}>
        {errors.to ? (
          <Text style={styles.tipError}>{errors.to}</Text>
        ) : (
          toAddressIsValid &&
          !toAddressInContactBook && (
            <Text style={styles.tipNoContact}>
              <Trans i18nKey="page.sendToken.addressNotInContract" t={t}>
                Not on address list.{' '}
                <Text
                  onPress={() => {
                    putScreenState({ addressToAddAsContacts: formValues.to });
                  }}
                  style={styles.textAddToContact}>
                  Add to contacts
                </Text>
              </Trans>
            </Text>
          )
        )}
      </View>

      <SelectAddressSheetModal
        visible={showListContactModal}
        onConfirm={contact => {
          handleFieldChange('to', contact.address);
          putScreenState({
            showListContactModal: false,
          });
        }}
        onCancel={() => {
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
      justifyContent: 'space-between',
    },

    sectionTitle: {
      color: colors['neutral-body'],
      fontSize: 13,
      fontWeight: 'normal',
    },

    commentLabelContainer: {
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

    commentLabel: {
      color: colors['blue-default'],
      fontSize: 12,
      fontWeight: 'normal',
    },

    inputContainer: {
      borderRadius: 4,

      width: '100%',
      height: 52,
    },

    input: {
      backgroundColor: colors['neutral-card2'],
      width: '100%',
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
