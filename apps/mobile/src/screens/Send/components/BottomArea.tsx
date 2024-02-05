import React, { useMemo, useCallback } from 'react';
import { useThemeColors } from '@/hooks/theme';
import { View, Text } from 'react-native';
import { Button } from '@/components';
import {
  useSendTokenFormik,
  useSendTokenInternalContext,
} from '../hooks/useSendToken';
import { useTranslation } from 'react-i18next';
import TouchableView from '@/components/Touchable/TouchableView';
import ThemeIcon from '@/components/ThemeMode/ThemeIcon';
import { createGetStyles } from '@/utils/styles';
import { ModalConfirmAllowTransfer } from './ConfirmAllowTransferSheetModal';

import RcIconUnCheck from '../icons/icon-uncheck-cc.svg';
import RcIconChecked from '../icons/icon-checked-cc.svg';

export default function BottomArea() {
  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { handleSubmit } = useSendTokenFormik();

  const {
    screenState: { temporaryGrant, isSubmitLoading, showWhitelistAlert },
    computed: { whitelistEnabled, canSubmit, toAddressInWhitelist },
    fns: { putScreenState },
  } = useSendTokenInternalContext();

  const whitelistAlertContent = useMemo(() => {
    if (!whitelistEnabled) {
      return {
        content: t('page.sendToken.whitelistAlert__disabled'),
        success: true,
        inlineIconColor: colors['neutral-foot'],
      };
    }
    if (toAddressInWhitelist) {
      return {
        content: t('page.sendToken.whitelistAlert__whitelisted'),
        success: true,
        prevIconColor: colors['neutral-foot'],
      };
    }
    if (temporaryGrant) {
      return {
        content: t('page.sendToken.whitelistAlert__temporaryGranted'),
        success: true,
        prevIconColor: colors['neutral-foot'],
      };
    }
    return {
      success: false,
      content: t('page.sendToken.whitelistAlert__notWhitelisted'),
      inlineIconColor: colors['neutral-foot'],
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

  return (
    <View style={styles.bottomDockArea}>
      {showWhitelistAlert && (
        <TouchableView
          disabled={canSendNow}
          onPress={handleClickAllowTransferTo}>
          <View style={styles.whitelistAlertContentContainer}>
            {whitelistAlertContent.prevIconColor && (
              <ThemeIcon
                src={
                  whitelistAlertContent.success ? RcIconChecked : RcIconUnCheck
                }
                color={whitelistAlertContent.prevIconColor}
              />
            )}
            <Text style={styles.whitelistAlertContentText}>
              {whitelistAlertContent.inlineIconColor && (
                <ThemeIcon
                  src={
                    whitelistAlertContent.success
                      ? RcIconChecked
                      : RcIconUnCheck
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
        style={styles.button}
        type="primary"
        title={'Send'}
        loading={isSubmitLoading}
        onPress={handleSubmit}
      />

      <ModalConfirmAllowTransfer
        visible={isAllowTransferModalVisible}
        onFinished={result => {
          if (result.confirmed) {
            putScreenState?.({ temporaryGrant: true });
          }
          setIsAllowTransferModalVisible(false);
        }}
        onCancel={() => {
          setIsAllowTransferModalVisible(false);
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
      backgroundColor: colors['neutral-bg1'],
      borderTopWidth: 0.5,
      borderTopStyle: 'solid',
      borderTopColor: colors['neutral-line'],
      position: 'absolute',
    },

    buttonContainer: {
      width: '100%',
      height: 52,
    },
    button: {
      backgroundColor: colors['blue-default'],
    },

    whitelistAlertContentContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 25,
      marginBottom: 16,
    },
    whitelistAlertContentText: {
      textAlign: 'center',
      justifyContent: 'center',
      lineHeight: 18,
    },
  };
});
