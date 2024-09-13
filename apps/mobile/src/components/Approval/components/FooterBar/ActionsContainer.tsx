import React from 'react';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Account } from '@/core/services/preference';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { notificationService } from '@/core/services';
import { Button } from '@/components';
import { StyleSheet, Text, View } from 'react-native';
import ArrowDownCC from '@/assets/icons/common/arrow-down-cc.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

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
}

export const ActionsContainer: React.FC<
  Pick<Props, 'onCancel' | 'children'>
> = ({ children, onCancel }) => {
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
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.wrapper}>
      {children}

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
    </View>
  );
};
