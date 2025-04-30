import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

export interface Props {
  onResend: () => void;
  onCancel: () => void;
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

export const FooterResendCancelGroup: React.FC<Props> = ({
  onResend,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle,
  });

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
          type="primary"
          onPress={onResend}
          title={t('page.signFooterBar.resend')}
        />
      </View>
    </View>
  );
};
