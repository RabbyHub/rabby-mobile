import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '../Button';
import AutoLockView from '@/components/AutoLockView';
import RcLpTokenIcon from '@/assets2024/icons/home/RcLpTokenIcon.svg';
import { useTranslation } from 'react-i18next';

export const LpTokenDescription: React.FC<{
  protocolId: string;
  onClose: () => void;
}> = ({ protocolId, onClose }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <AutoLockView as="View" style={styles.container}>
      <View>
        <RcLpTokenIcon
          width={24}
          height={24}
          color={colors2024['neutral-secondary']}
        />
      </View>
      <Text style={styles.title}>
        {t('component.lpTokenModal.desc', { protocolId })}
      </Text>
      <Button
        containerStyle={styles.button}
        title={t('global.GotIt')}
        onPress={onClose}
      />
    </AutoLockView>
  );
};
const getStyles = createGetStyles2024(ctx => ({
  container: {
    paddingHorizontal: 25,
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: 'SF Pro Rounded',
    paddingHorizontal: 5,
  },
  button: {
    position: 'absolute',
    bottom: 56,
    width: '100%',
  },
}));
