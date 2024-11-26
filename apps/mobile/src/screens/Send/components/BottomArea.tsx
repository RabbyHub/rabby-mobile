import React, { useMemo, useCallback } from 'react';
import { Platform, View, Text } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { Button } from '@/components';
import {
  useSendTokenFormik,
  useSendTokenInternalContext,
} from '../hooks/useSendToken';
import { useTranslation } from 'react-i18next';
import TouchableView from '@/components/Touchable/TouchableView';
import ThemeIcon from '@/components/ThemeMode/ThemeIcon';
import { createGetStyles } from '@/utils/styles';

import { RcIconCheckedCC, RcIconUnCheckCC } from '@/assets/icons/send';
import { ModalConfirmAllowTransfer } from '@/components/Address/SheetModalConfirmAllowTransfer';
import { ModalAddToContacts } from '@/components/Address/SheetModalAddToContacts';
import { apiBalance } from '@/core/apis';
import { useSafeSizes } from '@/hooks/useAppLayout';

const isAndroid = Platform.OS === 'android';

export default function BottomArea() {
  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { handleSubmit } = useSendTokenFormik();

  const {
    formValues,
    screenState,
    computed: {
      whitelistEnabled,
      canSubmit,
      toAddressInWhitelist,
      toAddressInContactBook,
    },
    fns: { putScreenState, fetchContactAccounts },
  } = useSendTokenInternalContext();

  const {
    temporaryGrant,
    isSubmitLoading,
    showWhitelistAlert,
    addressToAddAsContacts,
  } = screenState;

  const shouldShowWhitelistAlert = formValues.to && showWhitelistAlert;

  const whitelistAlertContent = useMemo(() => {
    if (!whitelistEnabled) {
      return {
        content: t('page.sendToken.whitelistAlert__disabled'),
        inlineIconColor: '',
        success: true,
      };
    }
    if (toAddressInWhitelist) {
      return {
        content: t('page.sendToken.whitelistAlert__whitelisted'),
        success: true,
        prevIconColor: colors['neutral-foot'],
        inlineIconColor: null,
      };
    }
    if (temporaryGrant) {
      return {
        content: t('page.sendToken.whitelistAlert__temporaryGranted'),
        success: true,
        prevIconColor: colors['neutral-foot'],
        inlineIconColor: null,
      };
    }

    return {
      success: false,
      content: t('page.sendToken.whitelistAlert__notWhitelisted'),
      inlineIconColor: colors['red-dark'],
    };
  }, [temporaryGrant, toAddressInWhitelist, whitelistEnabled, t, colors]);

  const [isAllowTransferModalVisible, setIsAllowTransferModalVisible] =
    React.useState(false);

  const canSendNow =
    !whitelistEnabled || temporaryGrant || toAddressInWhitelist;

  const handleClickAllowTransferTo = useCallback(() => {
    if (canSendNow) return;

    setIsAllowTransferModalVisible(true);
  }, [canSendNow]);

  const { safeOffBottom } = useSafeSizes();

  return (
    <View
      style={[
        styles.bottomDockArea,
        isAndroid && { paddingBottom: 20 + safeOffBottom },
      ]}>
      {shouldShowWhitelistAlert && (
        <TouchableView
          disabled={canSendNow}
          onPress={handleClickAllowTransferTo}>
          <View style={styles.whitelistAlertContentContainer}>
            {whitelistAlertContent.prevIconColor && (
              <ThemeIcon
                src={
                  whitelistAlertContent.success
                    ? RcIconCheckedCC
                    : RcIconUnCheckCC
                }
                color={whitelistAlertContent.prevIconColor}
              />
            )}
            <Text
              style={[
                styles.whitelistAlertContentText,
                !whitelistAlertContent.success && styles.errorText,
              ]}>
              {whitelistAlertContent.inlineIconColor && (
                <ThemeIcon
                  src={
                    whitelistAlertContent.success
                      ? RcIconCheckedCC
                      : RcIconUnCheckCC
                  }
                  color={whitelistAlertContent.inlineIconColor}
                />
              )}{' '}
              {whitelistAlertContent.content}
            </Text>
          </View>
        </TouchableView>
      )}
      <Button
        disabled={!canSubmit}
        containerStyle={styles.buttonContainer}
        titleStyle={styles.buttonText}
        type="primary"
        title={'Send'}
        loading={isSubmitLoading}
        onPress={handleSubmit}
      />

      <ModalConfirmAllowTransfer
        toAddr={formValues.to}
        visible={isAllowTransferModalVisible}
        showAddToWhitelist={toAddressInContactBook}
        onFinished={result => {
          putScreenState?.({ temporaryGrant: true });
          setIsAllowTransferModalVisible(false);
        }}
        onCancel={() => {
          setIsAllowTransferModalVisible(false);
        }}
      />

      <ModalAddToContacts
        addrToAdd={addressToAddAsContacts || ''}
        onFinished={async result => {
          putScreenState({ addressToAddAsContacts: null });
          fetchContactAccounts();

          // trigger get balance of address
          apiBalance.getAddressBalance(result.contactAddrAdded, {
            force: true,
          });
        }}
        onCancel={() => {
          putScreenState({ addressToAddAsContacts: null });
        }}
      />
    </View>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    bottomDockArea: {
      bottom: 0,
      width: '100%',
      padding: 20,
      position: 'absolute',
    },

    buttonContainer: {
      width: '100%',
      height: 52,
      borderRadius: 6,
      ...(!isAndroid && {
        marginBottom: 16,
      }),
    },

    buttonText: {
      color: colors['neutral-title-2'],
    },

    whitelistAlertContentContainer: {
      flexDirection: 'row',
      // flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 0,
      marginBottom: 16,
    },
    whitelistAlertContentText: {
      textAlign: 'center',
      justifyContent: 'center',
      lineHeight: 18,
      color: colors['neutral-foot'],
    },
    errorText: {
      color: colors['red-dark'],
    },
  };
});
