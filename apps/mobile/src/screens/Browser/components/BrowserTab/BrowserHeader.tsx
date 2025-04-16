import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { RcIconCloseCC } from '@/assets/icons/common';
import { useAccountSceneVisible } from '@/components/AccountSwitcher/hooks';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
// import { RcIconCloseCC, RcIconCloseCircleCC } from '@/assets/icons/common';

export function BrowserHeader({ url }: { url: string }) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const navigation = useRabbyAppNavigation();
  const forScene = '@ActiveDappWebViewModal';
  const { finalSceneCurrentAccount, sceneCurrentAccount } = useSceneAccountInfo(
    {
      forScene,
    },
  );
  const { isVisible: isOpen, toggleSceneVisible } =
    useAccountSceneVisible(forScene);

  const handleClose = useMemoizedFn(() => {
    navigation.goBack();
  });

  const urlInfo = useMemo(() => urlUtils.canoicalizeDappUrl(url), [url]);

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => {
          toggleSceneVisible(forScene, !isOpen);
        }}>
        {finalSceneCurrentAccount ? (
          <WalletIcon
            type={finalSceneCurrentAccount?.type}
            width={24}
            height={24}
            style={styles.walletIcon}
          />
        ) : null}
      </TouchableOpacity>
      <View style={styles.addressBar}>
        <Text style={styles.addressBarText}>{urlInfo.fullDomain}</Text>
      </View>
      <View>
        <TouchableOpacity onPress={handleClose}>
          <View style={styles.iconCloseCircle}>
            <RcIconCloseCC
              width={21}
              height={21}
              color={colors2024['neutral-title-1']}
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 9,
    gap: 12,
    // borderBottomWidth: 1,
    // borderBottomColor: colors2024['neutral-line'],
  },
  walletIcon: { borderRadius: 6 },
  addressBar: {
    minWidth: 0,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
  },
  addressBarText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  iconCloseCircle: {
    width: 32,
    height: 32,
    backgroundColor: colors2024['neutral-bg-2'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
  },
}));
