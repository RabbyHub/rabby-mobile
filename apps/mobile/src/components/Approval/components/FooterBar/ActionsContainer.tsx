import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Account } from '@/core/services/preference';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { notificationService } from '@/core/services';
import { StyleSheet, Text, View } from 'react-native';
import ArrowDownCC from '@/assets/icons/common/arrow-down-cc.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Button } from '@/components2024/Button';

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
  isSwap?: boolean;
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
  directSubmit?: boolean;
  miniSignType?: 'tx' | 'typedData';
  loading?: boolean;
}

export interface PropsWithAuthSession extends Props {
  USE_LAST_UNLOCKED_AUTH?: boolean;
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

  const { styles } = useTheme2024({ getStyle: getStyles2024 });

  return (
    <View style={styles.wrapper}>
      {isMiniSignTx ? null : (
        <Button
          type="ghost"
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
      )}

      {children}
    </View>
  );
};
