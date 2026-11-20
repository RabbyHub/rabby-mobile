import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import RcMemeCoinTitle from '@/assets2024/memecoin/memecoin-title.svg';
import RcIconWarning from '@/assets2024/memecoin/warning.svg';
import { HeaderAccountSwitcher } from '@/components/AccountSwitcher/HeaderAccountSwitcher';
import { toastWithIcon } from '@/components2024/Toast';
import { ScreenLayouts } from '@/constant/layout';
import { HeaderBackPressable } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const toastWarning = toastWithIcon(RcIconWarning);

export const MemeCoinHeader = ({
  disableSwitch,
}: {
  disableSwitch?: boolean;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { top } = useSafeAreaInsets();
  const warnSwitchUnsupported = () => {
    toastWarning(t('page.memeCoin.addressSwitchUnsupported'));
  };

  return (
    <View style={[styles.outer, { paddingTop: top }]}>
      <View style={styles.inner}>
        <View style={styles.side}>
          <HeaderBackPressable style={styles.back} />
        </View>
        <RcMemeCoinTitle width={115} height={24} />
        <View style={[styles.side, styles.right]}>
          <HeaderAccountSwitcher
            forScene="MakeTransactionAbout"
            disableSwitch={disableSwitch}
            onDisabledPress={warnSwitchUnsupported}
            hideAccountName
            showCaretWhenDisabled
            style={styles.switcher}
          />
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  outer: {
    backgroundColor: colors2024['neutral-bg-0'],
  },
  inner: {
    // the transparent header overlays the page; screens pad by safeOffHeader
    height: ScreenLayouts.headerAreaHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 16,
  },
  side: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  right: {
    justifyContent: 'flex-end',
  },
  back: {
    marginLeft: 0,
    paddingLeft: 0,
  },
  switcher: {
    flexShrink: 1,
    minWidth: 0,
  },
}));
