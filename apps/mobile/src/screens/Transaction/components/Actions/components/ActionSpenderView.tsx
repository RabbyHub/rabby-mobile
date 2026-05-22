/* eslint-disable react-native/no-inline-styles */
import { RcIconRightCC } from '@/assets/icons/common';
import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import ViewMore from '@/components/Approval/components/Actions/components/ViewMore';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { toast } from '@/components2024/Toast';
import { useTheme2024 } from '@/hooks/theme';
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
  type?: 'spender' | 'nftSpender';
};

export const ActionSpenderView = ({
  requireData,
  spender,
  chain,
  type = 'spender',
}: Props) => {
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
    <View style={{ alignItems: 'flex-end', minWidth: 0, flexShrink: 1 }}>
      <ViewMore
        type={type}
        data={{
          ...requireData,
          spender,
          chain,
        }}>
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
            <RcIconRightCC
              width={14}
              height={14}
              color={colors2024['neutral-foot']}
            />
          </View>
          <Text style={styles.itemAddressText}>{spender}</Text>
        </View>
      </ViewMore>
      <TouchableOpacity
        disabled={!spender}
        onPress={handleOpenSpender}
        style={styles.explorerLink}>
        <RcIconJumpCC
          width={14}
          height={14}
          color={colors2024['neutral-foot']}
        />
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  explorerLink: {
    marginTop: 4,
    padding: 2,
  },
  itemAddressText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    textAlign: 'right',
    width: 170,
  },
  itemContentText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
}));
