import { Button } from '@/components2024/Button';
import { Account } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import { RetryUpdateType } from '@/utils/errorTxRetry';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SvgProps } from 'react-native-svg';

export interface Props {
  onResend: () => void;
  onCancel: () => void;
  BrandIcon?: React.FC<SvgProps>;
  retryUpdateType?: RetryUpdateType;
}

const getStyle = createGetStyles2024(({ colors2024 }) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      gap: 8,
      width: '100%',
      paddingHorizontal: 16,
    },
    item: {
      width: '50%',
      flex: 1,
    },
  }),
);

export const MiniFooterResendCancelGroup: React.FC<Props> = ({
  onResend,
  onCancel,
  BrandIcon,
  retryUpdateType = 'origin',
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle,
  });

  if (!retryUpdateType) {
    return (
      <View style={styles.wrapper}>
        <View style={{ flex: 1 }}>
          <Button
            icon={undefined}
            type="primary"
            onPress={onCancel}
            title={t('page.signFooterBar.got')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.item}>
        <Button
          type="ghost"
          onPress={onCancel}
          title={t('global.cancelButton')}
        />
      </View>
      <View style={styles.item}>
        <Button
          icon={BrandIcon ? <BrandIcon width={22} height={22} /> : undefined}
          type="primary"
          onPress={onResend}
          title={t('page.signFooterBar.resend')}
        />
      </View>
    </View>
  );
};
