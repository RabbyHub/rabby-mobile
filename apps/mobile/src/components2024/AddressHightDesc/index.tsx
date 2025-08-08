import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import AutoLockView from '@/components/AutoLockView';
import { Button, ButtonProps } from '../Button';
import { useTranslation } from 'react-i18next';

export const AddressHightDesc: React.FC<{
  address: string;
  nextButtonProps?: ButtonProps;
}> = ({ address, nextButtonProps }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const addressSplit = useMemo(() => {
    if (!address) {
      return [];
    }
    const prefix = address.slice(0, 8);
    const middle = address.slice(8, -6);
    const suffix = address.slice(-6);

    return [prefix, middle, suffix];
  }, [address]);
  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <Text style={[styles.title]}>{t('page.sendToken.addressDetail')}</Text>
      <View style={[styles.addressContainer]}>
        <View style={[styles.bubble]}>
          <Text style={styles.qrCardAddress}>
            <Text style={styles.highlightAddrPart}>{addressSplit[0]}</Text>
            {addressSplit[1]}
            <Text style={styles.highlightAddrPart}>{addressSplit[2]}</Text>
          </Text>
        </View>
      </View>
      {nextButtonProps && (
        <Button containerStyle={styles.button} {...nextButtonProps} />
      )}
    </AutoLockView>
  );
};
const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    paddingHorizontal: 20,
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  addressContainer: {
    marginTop: 21,
    width: '100%',
  },
  bubble: {
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-4'],
    paddingHorizontal: 42,
    paddingVertical: 9,
  },
  qrCardAddress: {
    width: '100%',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  highlightAddrPart: {
    color: colors2024['neutral-body'],
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  button: {
    position: 'absolute',
    bottom: 48,
    width: '100%',
  },
}));
