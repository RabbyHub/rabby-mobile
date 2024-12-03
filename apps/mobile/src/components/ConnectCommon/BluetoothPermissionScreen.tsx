import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import { useTheme2024 } from '@/hooks/theme';
import { SvgProps } from 'react-native-svg';
import { createGetStyles2024 } from '@/utils/styles';
import { Button } from '@/components2024/Button';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    height: '100%',
    position: 'relative',
  },
  main: {
    flex: 1,
    alignItems: 'center',
  },
  text: {
    fontSize: 17,
    color: colors2024['neutral-secondary'],
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  list: {
    marginBottom: 24,
  },
  logo: {
    marginTop: 40,
  },
  titleText: {
    fontSize: 20,
    color: colors2024['neutral-title-1'],
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
  footerButton: {
    marginBottom: 56,
    paddingHorizontal: 20,
  },
}));

type Props = {
  onNext: () => void;
  titleText: string;
  descriptionText: string;
  DeviceLogo: React.FC<SvgProps>;
};

export const CommonBluetoothPermissionScreen: React.FC<Props> = ({
  titleText,
  descriptionText,
  onNext,
  DeviceLogo,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.root}>
      <AppBottomSheetModalTitle title={titleText} style={styles.titleText} />
      <View style={styles.main}>
        <Text style={styles.text}>{descriptionText}</Text>
        <DeviceLogo style={styles.logo} />
      </View>
      <Button
        style={styles.footerButton}
        type="primary"
        onPress={onNext}
        title={t('global.next')}
      />
    </View>
  );
};
