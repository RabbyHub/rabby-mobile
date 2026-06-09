import React from 'react';
import { View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { AccountSwitcher } from '@/components/AccountSwitcher/InScreenSwitch';
import { AccountSwitcherScene } from '@/components/AccountSwitcher/hooks';
import { E2E_ID } from '@/constant/e2e';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { Text } from '@/components/Typography';

function FromAddressControl2024({
  style,
  disableSwitch,
}: React.PropsWithChildren<
  RNViewProps & { disableSwitch?: boolean; forScene?: AccountSwitcherScene }
>) {
  const { styles } = useTheme2024({ getStyle });

  const { t } = useTranslation();

  return (
    <View
      style={[styles.control, style]}
      {...makeTestIDProps(E2E_ID.send.fromSection)}>
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

export default React.memo(FromAddressControl2024);

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
      paddingHorizontal: 8,
    },

    sectionTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
  };
});
