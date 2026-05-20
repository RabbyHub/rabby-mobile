/* eslint-disable react-native/no-inline-styles */
import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import { AssetAvatar } from '@/components';
import { Text } from '@/components/Typography';
import { toast } from '@/components2024/Toast';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import { openTxExternalUrl } from '@/utils/transaction';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';

type Props = {
  title: string;
  name?: string;
  logo?: string;
  address?: string;
  chain?: Parameters<typeof openTxExternalUrl>[0]['chain'];
  style?: StyleProp<ViewStyle>;
};

export const ProjectItemInDetail = ({
  title,
  name,
  logo,
  address,
  chain,
  style,
}: Props) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const handleOpenAddress = useCallback(() => {
    if (chain && address) {
      const result = openTxExternalUrl({ chain, address });
      if (!result.canOpen) {
        toast.error('Unknown chain');
      }
    } else {
      toast.error('Unknown chain');
    }
  }, [address, chain]);

  return (
    <View style={[style || styles.detailItem]}>
      <Text style={styles.itemTitleText} numberOfLines={1}>
        {title}
      </Text>
      <TouchableOpacity
        style={{
          alignItems: 'flex-end',
          flexShrink: 1,
          minWidth: 0,
        }}
        onPress={handleOpenAddress}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
            width: '100%',
            justifyContent: 'flex-end',
          }}>
          <AssetAvatar logo={logo} size={16} />
          <Text style={styles.itemContentText} numberOfLines={1}>
            {name || t('global.Unknown')}
          </Text>
          <RcIconJumpCC
            width={14}
            height={14}
            color={colors2024['neutral-foot']}
          />
        </View>
        <Text style={styles.itemAddressText}>
          {/* {ellipsisAddress(address || '')} */}
          {address}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  detailItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 4,
  },
  itemTitleText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    maxWidth: '45%',
    minWidth: 0,
  },
  itemAddressText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
    width: 170,
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
    minWidth: 0,
    flexShrink: 1,
  },
}));
