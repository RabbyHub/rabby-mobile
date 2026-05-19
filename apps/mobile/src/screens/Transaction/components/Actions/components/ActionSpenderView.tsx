/* eslint-disable react-native/no-inline-styles */
import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { toast } from '@/components2024/Toast';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { openTxExternalUrl } from '@/utils/transaction';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

type Chain = NonNullable<ReturnType<typeof findChain>>;

type Props = {
  requireData?: any;
  spender: string;
  chain?: Chain;
};

export const ActionSpenderView = ({ requireData, spender, chain }: Props) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const handleOpenSpender = useMemoizedFn(() => {
    if (chain?.scanLink) {
      openTxExternalUrl({ chain, address: spender });
    } else {
      toast.error('Unknown chain');
    }
  });

  return (
    <TouchableOpacity
      disabled={!spender}
      onPress={handleOpenSpender}
      style={{ alignItems: 'flex-end' }}>
      <View style={{ alignItems: 'flex-end' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
          <AssetAvatar logo={requireData?.protocol?.logo_url} size={16} />
          <Text style={styles.itemContentText}>
            {requireData?.protocol?.name || t('global.Unknown')}
          </Text>
          <RcIconJumpCC
            width={14}
            height={14}
            color={colors2024['neutral-foot']}
          />
        </View>
        <Text style={styles.itemAddressText}>{ellipsisAddress(spender)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  itemAddressText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  itemContentText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
}));
