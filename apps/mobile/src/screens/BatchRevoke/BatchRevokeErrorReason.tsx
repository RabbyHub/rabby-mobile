import { FailedCode } from '@/utils/sendTransaction';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import FailedSVG from '@/assets/icons/batchRevoke/failed.svg';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  FooterButtonContainer2024Props,
  FooterButtonScreenContainer,
} from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import BigNumber from 'bignumber.js';
import React from 'react';
import { FailReason } from './useBatchRevokeTask';
import { formatGasCostUsd } from '@/utils/number';

export const BatchRevokeErrorReason: React.FC<{
  onStillRevoke: () => void;
  failedCode?: FailedCode;
  gasCostUsd?: BigNumber;
  onCancel?: () => void;
}> = ({ failedCode, gasCostUsd, onCancel, onStillRevoke }) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle: getStyle,
  });
  const canStillRevoke = React.useMemo(() => {
    return failedCode === FailedCode.GasTooHigh && gasCostUsd;
  }, [failedCode, gasCostUsd]);

  const footerButtonProps = React.useMemo(() => {
    if (canStillRevoke) {
      return {
        buttonGroupProps: {
          onCancel,
          onConfirm: onStillRevoke,
          cancelText: t('global.Cancel'),
          confirmText: t('page.approvals.revokeModal.stillRevoke'),
          confirmType: 'primary',
        },
      } as FooterButtonContainer2024Props;
    } else {
      return {
        buttonProps: {
          onPress: onCancel,
          title: t('page.approvals.revokeModal.iGotIt'),
        },
      } as FooterButtonContainer2024Props;
    }
  }, [canStillRevoke, onCancel, onStillRevoke, t]);

  return (
    <FooterButtonScreenContainer
      {...footerButtonProps}
      noHeader
      footerBottomOffset={56}
      style={styles.root}>
      <View style={styles.title}>
        <FailedSVG />
        <Text style={styles.titleText}>
          {t('page.approvals.errorReason.title')}
        </Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.contentText}>
          {FailReason[failedCode ?? FailedCode.DefaultFailed]}
          {canStillRevoke &&
            gasCostUsd &&
            `(Est. Gas ≈$ ${formatGasCostUsd(gasCostUsd)})`}
        </Text>
      </View>
    </FooterButtonScreenContainer>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    height: 200,
    justifyContent: 'flex-start',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors2024['red-default'],
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentText: {
    fontSize: 16,
    fontWeight: '400',
    color: colors2024['red-default'],
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
}));
