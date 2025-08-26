import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export const PerpsFooter: React.FC<{}> = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.footer}>
      <View style={styles.btnGroup}>
        <View style={styles.btnContainer}>
          <Button type="primary" title={'Long'} />
        </View>
        <View style={styles.btnContainer}>
          <Button type="primary" title={'Short'} />
        </View>
      </View>
      {/* <Button type="primary" title={'Close Position'} /> */}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  footer: {
    backgroundColor: colors2024['neutral-bg-1'],
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 56,
  },
  btnGroup: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  btnContainer: {
    flex: 1,
  },
}));
