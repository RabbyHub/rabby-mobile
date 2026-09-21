import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Typography';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

type Props = {
  checked: boolean;
  onToggle: () => void;
  style?: StyleProp<ViewStyle>;
};

export const SignRiskWarning = ({ checked, onToggle, style }: Props) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <Pressable style={[styles.riskContainer, style]} onPress={onToggle}>
      <CheckBoxRect checked={checked} />
      <Text style={styles.warningText}>
        {t('page.bridge.showMore.signWarning')}
      </Text>
    </Pressable>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  riskContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 4,
  },
  warningText: {
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
