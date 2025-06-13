import { useTheme2024 } from '@/hooks/theme';
import OfflinePng from '@/assets2024/images/offline.png';
import { createGetStyles2024 } from '@/utils/styles';
import { View, Text, StyleProp, ViewStyle, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button';
import { ErrorType } from '@/hooks/useGlobalStatus';

interface NetWorkErrorProps {
  errorType: ErrorType;
  style?: StyleProp<ViewStyle>;
  onRefresh?: () => void;
}
export function NetWorkError({
  errorType,
  style,
  onRefresh,
}: NetWorkErrorProps) {
  const { styles } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();

  return (
    <View style={[styles.container, style]}>
      <Image style={styles.img} source={OfflinePng} />
      <Text style={styles.title}>
        {errorType === 'network'
          ? t('component.globalWarning.offlineText')
          : t('component.globalWarning.serviceErrorText')}
      </Text>
      {errorType === 'service' && (
        <Button
          onPress={onRefresh}
          buttonStyle={styles.btn}
          titleStyle={styles.btnText}
          title={t('component.globalWarning.buttonText')}
        />
      )}
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  img: {
    width: 163,
    height: 126,
  },
  title: {
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    marginTop: 21,
    marginBottom: 12,
  },
  btn: {
    width: 81,
    height: 28,
    borderRadius: 6,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
}));
