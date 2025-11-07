import React from 'react';
import { Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { AccountSwitcher } from '@/components/AccountSwitcher/InScreenSwitch';
import { AccountSwitcherScene } from '@/components/AccountSwitcher/hooks';

export default function FromAddressControl2024({
  style,
  disableSwitch,
}: React.PropsWithChildren<
  RNViewProps & { disableSwitch?: boolean; forScene?: AccountSwitcherScene }
>) {
  const { styles } = useTheme2024({ getStyle });

  const { t } = useTranslation();

  return (
    <View style={[styles.control, style]}>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>{t('page.sendToken.From')}</Text>
      </View>
      <AccountSwitcher
        forScene={'MakeTransactionAbout'}
        disableSwitch={disableSwitch}
      />
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    control: {
      width: '100%',
      gap: 12,
    },

    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    sectionTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
  };
});
