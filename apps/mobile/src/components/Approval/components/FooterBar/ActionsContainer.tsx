import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Account } from '@/core/services/preference';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { notificationService } from '@/core/services';
import { View } from 'react-native';
import ArrowDownCC from '@/assets/icons/common/arrow-down-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_GAP,
  BOTTOM_BUTTON_TOP_OFFSET,
} from '@/constant/layout';

const getStyles2024 = createGetStyles2024(({ colors2024 }) => ({
  button: {
    height: BOTTOM_BUTTON_DOUBLE_HEIGHT,
    borderRadius: 12,
  },
  wrapper: {
    position: 'relative',
    flexDirection: 'row',
    marginTop: BOTTOM_BUTTON_TOP_OFFSET,
    justifyContent: 'space-between',
    gap: BOTTOM_BUTTON_GAP,
  },
  cancelIcon: {
    color: colors2024['neutral-title-1'],
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
          type="plain"
          height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
          containerStyle={{
            flex: 1,
          }}
          buttonStyle={styles.button}
          onPress={displayPopup ? activeCancelPopup : onCancel}
          title={t('global.cancelButton')}
          iconRight={
            displayPopup ? (
              //@ts-expect-error
              <ArrowDownCC style={styles.cancelIcon} width={12} />
            ) : null
          }
        />
      )}

      {children}
    </View>
  );
};
