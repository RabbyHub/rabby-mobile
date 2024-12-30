import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Account } from '@/core/services/preference';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { notificationService } from '@/core/services';
import { Button } from '@/components';
import { StyleSheet, Text, View } from 'react-native';
import ArrowDownCC from '@/assets/icons/common/arrow-down-cc.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    button: {
      height: 48,
      borderColor: colors['blue-default'],
      borderWidth: 1,
      borderRadius: 8,
    },
    buttonText: {
      color: colors['blue-default'],
      fontSize: 15,
      fontWeight: '500',
    },
    wrapper: {
      position: 'relative',
      flexDirection: 'row',
      marginTop: 12,
      justifyContent: 'space-between',
      gap: 12,
    },
    cancelWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cancelIcon: {
      color: colors['blue-default'],
    },
  });

const getStyles2024 = createGetStyles2024(({ colors2024 }) => ({
  button: {
    height: 56,
    borderColor: colors2024['brand-default'],
    borderWidth: 1,
    borderRadius: 100,
  },
  buttonText: {
    color: colors2024['brand-default'],
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  wrapper: {
    position: 'relative',
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelIcon: {
    color: colors2024['brand-default'],
  },
}));

export interface Props {
  onSubmit(): void;
  onCancel(): void;
  account: Account;
  disabledProcess: boolean;
  enableTooltip?: boolean;
  tooltipContent?: React.ReactNode;
  children?: React.ReactNode;
  chain?: Chain;
  submitText?: string;
  gasLess?: boolean;
  isPrimary?: boolean;
  gasLessThemeColor?: string;
  isGasNotEnough?: boolean;
  buttonIcon?: React.ReactNode;
  isMiniSignTx?: boolean;
}

export const ActionsContainer: React.FC<
  Pick<Props, 'onCancel' | 'children' | 'isMiniSignTx'>
> = ({ children, onCancel, isMiniSignTx }) => {
  const { t } = useTranslation();
  const [displayBlockedRequestApproval, setDisplayBlockedRequestApproval] =
    React.useState(false);
  const [displayCancelAllApproval, setDisplayCancelAllApproval] =
    React.useState(false);
  const { activePopup, setData } = useCommonPopupView();

  React.useEffect(() => {
    setDisplayBlockedRequestApproval(
      notificationService.checkNeedDisplayBlockedRequestApproval(),
    );
    setDisplayCancelAllApproval(
      notificationService.checkNeedDisplayCancelAllApproval(),
    );
  }, []);

  const displayPopup =
    displayBlockedRequestApproval || displayCancelAllApproval;

  const activeCancelPopup = () => {
    setData({
      onCancel,
      displayBlockedRequestApproval,
      displayCancelAllApproval,
    });
    activePopup('CANCEL_APPROVAL');
  };

  const colors = useThemeColors();
  const oldStyles = React.useMemo(() => getStyles(colors), [colors]);

  const { styles: styles2024 } = useTheme2024({ getStyle: getStyles2024 });

  const styles = useMemo(
    () => (isMiniSignTx ? styles2024 : oldStyles),
    [styles2024, oldStyles, isMiniSignTx],
  );
  return (
    <View style={styles.wrapper}>
      <Button
        type="clear"
        containerStyle={{
          flex: 1,
        }}
        buttonStyle={styles.button}
        titleStyle={styles.buttonText}
        onPress={displayPopup ? activeCancelPopup : onCancel}
        title={
          <View style={styles.cancelWrapper}>
            <Text style={styles.buttonText}>{t('global.cancelButton')}</Text>
            {displayPopup && (
              //@ts-expect-error
              <ArrowDownCC style={styles.cancelIcon} width={12} />
            )}
          </View>
        }
      />

      {children}
    </View>
  );
};
