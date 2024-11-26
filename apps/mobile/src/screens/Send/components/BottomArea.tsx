import React, { useMemo, useCallback } from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import {
  useSendTokenFormik,
  useSendTokenInternalContext,
} from '../hooks/useSendToken';
import { useTranslation } from 'react-i18next';
import { createGetStyles2024 } from '@/utils/styles';
import { ModalConfirmAllowTransfer } from '@/components/Address/SheetModalConfirmAllowTransfer';
import { ModalAddToContacts } from '@/components/Address/SheetModalAddToContacts';
import { apiBalance } from '@/core/apis';
import { useSafeSizes } from '@/hooks/useAppLayout';
import CheckboxSVG from '@/assets2024/icons/common/checkbox-cc.svg';
import { Button } from '@/components2024/Button';

const isAndroid = Platform.OS === 'android';

export default function BottomArea() {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

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
    if (whitelistEnabled && !toAddressInWhitelist && !temporaryGrant) {
      return {
        success: false,
        content: t('page.sendToken.whitelistAlert__notWhitelisted'),
        inlineIconColor: '#DDDFE4',
      };
    }
  }, [whitelistEnabled, toAddressInWhitelist, temporaryGrant, t]);

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
      {shouldShowWhitelistAlert && whitelistAlertContent && (
        <TouchableOpacity
          disabled={canSendNow}
          onPress={handleClickAllowTransferTo}>
          <View style={styles.whitelistAlertContentContainer}>
            {whitelistAlertContent.inlineIconColor && (
              <CheckboxSVG
                color={whitelistAlertContent.inlineIconColor}
                width={24}
                height={24}
              />
            )}
            <Text style={[styles.whitelistAlertContentText]}>
              {whitelistAlertContent.content}
            </Text>
          </View>
        </TouchableOpacity>
      )}
      <Button
        disabled={!canSubmit}
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

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    bottomDockArea: {
      bottom: 0,
      width: '100%',
      paddingHorizontal: 24,
      position: 'absolute',
      marginBottom: 56,
    },

    buttonContainer: {},

    buttonText: {
      color: colors2024['neutral-title-2'],
    },

    whitelistAlertContentContainer: {
      flexDirection: 'row',
      marginBottom: 20,
      gap: 8,
    },
    whitelistAlertContentText: {
      lineHeight: 24,
      fontSize: 16,
      fontWeight: '400',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      flex: 1,
    },
  };
});
