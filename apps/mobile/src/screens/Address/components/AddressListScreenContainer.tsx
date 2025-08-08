import React, { useEffect } from 'react';
import { useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/core';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { redirectToAddAddressEntry } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';

export type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

export const AddressListScreenContainer: React.FC<any> = ({
  children,
  style,
}) => {
  const { accounts } = useAccounts();
  const { styles } = useTheme2024({ getStyle });

  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  useEffect(() => {
    if (!accounts?.length) {
      redirectToAddAddressEntry({ action: 'classical:resetTo' });
    }
  }, [accounts, navigation]);

  return (
    <NormalScreenContainer2024 overwriteStyle={[styles.root, style]}>
      {children}
      {/* <LinearGradient
        pointerEvents="none"
        colors={[
          colord(colors2024['neutral-bg-3']).alpha(0.3).toHex(),
          colors2024['neutral-bg-1'],
        ]}
        style={styles.footerShadow}
      /> */}
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    position: 'relative',
  },
  buttonTitleText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
  },
  footer: {
    alignItems: 'center',
  },
  footerShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    height: 122,
  },
  button: {
    width: 200,
    margin: 'auto',
    backgroundColor: colors2024['neutral-bg-3'],
  },
  buttonWrapper: {
    position: 'absolute',
    zIndex: 1,
    bottom: 56,
    width: 200,
    left: '50%',
    marginLeft: -100,
  },
}));
