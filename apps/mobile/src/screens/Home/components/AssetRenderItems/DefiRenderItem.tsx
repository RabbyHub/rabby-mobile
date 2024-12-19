import React from 'react';
import { View, TouchableOpacity } from 'react-native';

import { AbstractProject } from '../../types';
import { useTheme2024 } from '@/hooks/theme';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components';
import { createGetStyles2024 } from '@/utils/styles';
import { DEFI_ID } from '@/utils/token';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';

const DefiRenderEntryItem = ({
  data,
  onPress,
  fold,
}: {
  data: AbstractProject;
  fold?: boolean;
  onPress?: () => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  if (data.id === DEFI_ID) {
    return (
      <View style={styles.headerWrapper}>
        <Text style={styles.symbol}>Defi</Text>
        <TouchableOpacity onPress={onPress} style={styles.totalUsdWrapper}>
          {/* TODO: fix ts */}
          <Text style={styles.totalUsd}>{data._usdValueStr || 0}</Text>
          <ArrowRightSVG
            style={[
              styles.arrow,
              {
                transform: fold
                  ? [{ rotate: '270deg' }]
                  : [{ rotate: '90deg' }],
              },
            ]}
            color={colors2024['neutral-title-1']}
          />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View>
      <TouchableOpacity onPress={onPress} style={[styles.projectHeader]}>
        <View style={styles.projectHeaderName}>
          <AssetAvatar
            logo={data?.logo}
            size={40}
            chain={data?.chain}
            chainSize={16}
          />
          <Text style={styles.projectName} numberOfLines={1}>
            {data?.name}
          </Text>
        </View>
        <View style={styles.projectHeaderUsd}>
          <Text style={styles.projectHeaderNetWorth}>{data._netWorth}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  //projectTitle
  projectHeader: {
    marginHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 68,
    alignItems: 'center',
  },
  projectHeaderName: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectName: {
    marginLeft: 8,
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  projectHeaderUsd: {
    alignSelf: 'flex-end',
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
  },
  projectHeaderNetWorth: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  headerWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  symbol: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-title-1'],
  },
  totalUsdWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  totalUsd: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  arrow: {},
}));

export default DefiRenderEntryItem;
