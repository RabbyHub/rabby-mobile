import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { TouchableOpacity } from 'react-native';
import { Text } from '@/components/Typography';
import IconAaveCC from '@/assets2024/icons/lending/IconAAVE-CC.svg';

export const AaveManageButton = ({ onPress }: { onPress: () => void }) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <TouchableOpacity style={[styles.button]} onPress={onPress}>
      <IconAaveCC
        color={isLight ? colors2024['neutral-InvertHighlight'] : '#192945'}
        width={20}
        height={20}
      />
      <Text style={styles.buttonText}>{t('component.portfolios.manage')}</Text>
    </TouchableOpacity>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  button: {
    marginTop: 0,
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: isLight ? '#2F3135' : '#fff',
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: isLight ? colors2024['neutral-InvertHighlight'] : '#192945',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));
