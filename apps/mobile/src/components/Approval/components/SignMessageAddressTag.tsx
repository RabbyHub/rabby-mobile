import React, { useMemo } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import IconDanger from '@/assets/icons/sign/security-engine/danger.svg';
import IconArrowRight from '@/assets/icons/approval/arrow-right-lite.svg';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import type { Chain } from '@/constant/chains';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { getTokenSymbol } from '@/utils/token';
import { getWalletIcon2024 } from '@/utils/walletInfo2024';
import ViewMore from './Actions/components/ViewMore';
import {
  getSignMessageAddressTagType,
  type SignMessageAddressData,
} from './signMessageAddressData';

export const SignMessageAddressTag = ({
  chain,
  data,
  onOpenTokenDetail,
}: {
  chain: Chain;
  data: SignMessageAddressData;
  onOpenTokenDetail: (token: TokenItem) => void;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { isLight } = useTheme2024();
  const tagType = getSignMessageAddressTagType(data);
  const danger = tagType === 'danger';
  const alias = data.alias;
  const token = data.token;
  const protocol = data.protocol;
  const opensTokenDetail = !!token && !danger && !alias;
  const label = danger
    ? 'Danger'
    : alias || (token ? getTokenSymbol(token) : protocol?.name || '');
  const walletIcon = useMemo(
    () =>
      getWalletIcon2024(
        data.localAccount?.brandName ||
          data.localAccount?.type ||
          KEYRING_TYPE.WatchAddressKeyring,
        isLight,
      ),
    [data.localAccount?.brandName, data.localAccount?.type, isLight],
  );
  const color = danger ? colors['red-default'] : colors['neutral-body'];
  const trigger = (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.trigger,
        {
          borderColor: danger ? colors['red-default'] : colors['neutral-line'],
          backgroundColor: danger ? colors['red-light'] : colors['neutral-bg2'],
        },
      ]}>
      {danger ? (
        <IconDanger width={16} height={16} style={styles.icon} />
      ) : alias && walletIcon ? (
        <Image source={walletIcon} style={styles.icon} />
      ) : token?.logo_url || protocol?.logo_url ? (
        <Image
          source={{ uri: token?.logo_url || protocol?.logo_url }}
          style={[styles.icon, styles.roundIcon]}
        />
      ) : null}
      <IconArrowRight width={16} height={16} color={color} />
    </View>
  );

  if (opensTokenDetail && token) {
    return (
      <TouchableOpacity
        accessibilityLabel={label}
        activeOpacity={0.7}
        onPress={() => onOpenTokenDetail(token)}>
        {trigger}
      </TouchableOpacity>
    );
  }

  if (data.isContract) {
    return (
      <ViewMore
        type="spender"
        title={t('page.signTx.contract')}
        data={{
          spender: data.address,
          chain,
          protocol,
          rank: data.contractInfo?.credit?.rank_at || null,
          bornAt:
            data.contractInfo?.create_at ||
            data.addressDesc?.contract?.[chain.serverId]?.create_at ||
            null,
          hasInteraction: data.hasInteraction,
          riskExposure: data.contractInfo?.spend_usd_value || 0,
          isEOA: false,
          isDanger:
            data.isMalicious ||
            data.contractInfo?.is_danger.auto ||
            data.contractInfo?.is_danger.edit ||
            false,
        }}>
        {trigger}
      </ViewMore>
    );
  }

  const cex = data.addressDesc?.cex;
  return (
    <ViewMore
      type="receiver"
      data={{
        title: t('page.signTx.tokenApprove.eoaAddress'),
        address: data.address,
        chain,
        eoa: {
          id: data.address,
          bornAt: data.addressDesc?.born_at || 0,
        },
        cex:
          cex && Object.keys(cex).length > 0
            ? {
                id: cex.id,
                name: cex.name,
                logo: cex.logo_url,
                bornAt: data.addressDesc?.born_at || 0,
                isDeposit: cex.is_deposit,
                supportToken: true,
              }
            : null,
        contract: null,
        usd_value: data.addressDesc?.usd_value || 0,
        hasTransfer: data.hasTransfer,
        isTokenContract: false,
        name: data.addressDesc?.name || null,
        onTransferWhitelist: data.onTransferWhitelist,
        hasReceiverPrivateKeyInWallet: data.hasReceiverPrivateKeyInWallet,
        hasReceiverMnemonicInWallet: data.hasReceiverMnemonicInWallet,
      }}>
      {trigger}
    </ViewMore>
  );
};

const styles = StyleSheet.create({
  trigger: {
    minWidth: 40,
    height: 22,
    paddingLeft: 6,
    paddingRight: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  icon: {
    width: 16,
    height: 16,
    marginRight: 2,
  },
  roundIcon: {
    borderRadius: 8,
  },
});
