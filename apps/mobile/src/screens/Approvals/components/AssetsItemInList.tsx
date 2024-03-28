import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { approvalUtils, bizNumberUtils } from '@rabby-wallet/biz-utils';

import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { type AssetApprovalSpender } from '../useApprovalsPage';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { findChainByServerID } from '@/utils/chain';
import { ellipsisAddress } from '@/utils/address';
import { SimulateUnderline } from '@/components/patches/Simulation';

import {
  RcIconCheckedCC,
  RcIconRightEntryCC,
  RcIconUncheckCC,
  RcIconUnknown,
} from '../icons';
import { ApprovalsLayouts } from './Layout';
import TouchableView from '@/components/Touchable/TouchableView';
import { toast } from '@/components/Toast';
import { Chain } from '@debank/common';
import { AssetAvatar } from '@/components';
import { stringUtils } from '@rabby-wallet/base-utils';

export const ContractFloorLayouts = {
  floor1: { height: 33, paddingTop: 0 },
  floor2: { height: 25, paddingTop: 5 },
  floor3: { height: 24, paddingTop: 4 },
};

function RightTouchableView({
  children,
  ...props
}: React.ComponentProps<typeof TouchableView>) {
  const { colors, styles } = useThemeStyles(getAssetItemStyles);

  return (
    <TouchableView
      {...props}
      style={[styles.floorRight, { height: '100%' }, props.style]}>
      <View style={styles.rowCenter}>{children}</View>
    </TouchableView>
  );
}

function AssetsItemInListProto({
  assetsItem,
  listIndex,
  onPressArea,
}: {
  assetsItem: AssetApprovalSpender;
  listIndex?: number;
  onPressArea?: (ctx: {
    type: 'selection' | 'entry' | 'trustValue' | 'revokeTrends';
    assetsItem: AssetApprovalSpender;
  }) => void;
} & RNViewProps) {
  const { colors, styles } = useThemeStyles(getAssetItemStyles);
  const { t } = useTranslation();

  const itemSelected = listIndex === 1;

  const { asset, assetInfo } = React.useMemo(() => {
    const asset = assetsItem.$assetParent;
    let chainItem: Chain | null = null;

    const assetInfo = {
      nftType: null as null | 'collection' | 'nft',
      nftTypeBadge: '',
      assetName: '',
      hasSubtitle: false,
    };

    if (asset?.type === 'nft') {
      // chainItem = findChainByServerID(asset?.chain as Chain['serverId']);
      assetInfo.nftType = asset.nftContract ? 'collection' : 'nft';
      assetInfo.nftTypeBadge =
        assetInfo.nftType === 'collection' ? 'Collection' : 'NFT';
      assetInfo.hasSubtitle = true;
    }

    const assetChainServerId = asset?.chain;

    assetInfo.assetName =
      asset?.type === 'nft' && asset?.nftToken
        ? stringUtils.ensureSuffix(
            asset?.name || 'Unknown',
            ` #${asset?.nftToken.inner_id}`,
          )
        : asset?.name || 'Unknown';

    const assetSubTitle = '';

    return {
      asset,
      assetInfo,
      assetChainServerId,
      assetSubTitle,
    };
  }, [assetsItem.$assetParent]);

  return (
    <TouchableView
      style={[styles.container, itemSelected && styles.selectedContainer]}
      onPress={evt => {
        onPressArea?.({ type: 'selection', assetsItem });
      }}>
      {/* floor 1 */}
      <View style={[styles.itemFloor, ContractFloorLayouts.floor1]}>
        <View style={styles.floorLeft}>
          {asset?.logo_url ? (
            <AssetAvatar
              logo={asset?.logo_url}
              logoStyle={{ backgroundColor: colors['neutral-foot'] }}
              chain={asset?.chain}
              chainIconPosition="tr"
              style={{ marginRight: 12 }}
              size={28}
              chainSize={16}
            />
          ) : (
            <RcIconUnknown width={28} height={28} style={styles.chainIcon} />
          )}
          <View style={styles.basicInfo}>
            <View style={styles.basicInfoF1}>
              <Text
                style={styles.assetNameText}
                ellipsizeMode="clip"
                numberOfLines={1}>
                {assetInfo.assetName}
              </Text>
              {/* <Text style={styles.contractName}>()</Text> */}
              {itemSelected ? (
                <RcIconCheckedCC
                  style={styles.contractCheckbox}
                  color={colors['blue-default']}
                />
              ) : (
                <RcIconUncheckCC
                  style={styles.contractCheckbox}
                  color={colors['neutral-line']}
                />
              )}
            </View>
            {assetInfo.nftTypeBadge && (
              <View style={styles.basicInfoF2}>
                <Text
                  style={styles.nftTypeBadge}
                  ellipsizeMode="clip"
                  numberOfLines={1}>
                  {assetInfo.nftTypeBadge}
                </Text>
              </View>
            )}
          </View>
        </View>
        <RightTouchableView
          style={[styles.floorRight, { height: '100%' }]}
          onPress={evt => {
            onPressArea?.({ type: 'entry', assetsItem });
          }}>
          <RcIconRightEntryCC
            width={14}
            height={14}
            color={colors['neutral-foot']}
          />
        </RightTouchableView>
      </View>
    </TouchableView>
  );
}

export const getAssetItemStyles = createGetStyles(colors => {
  return {
    container: {
      borderRadius: 8,
      backgroundColor: colors['neutral-card1'],
      flexDirection: 'column',
      justifyContent: 'center',
      paddingVertical: 10,
      height: ApprovalsLayouts.assetsItemHeight,
      width: '100%',
      padding: ApprovalsLayouts.assetsItemPadding,
      maxWidth:
        Dimensions.get('window').width -
        ApprovalsLayouts.innerContainerHorizontalOffset * 2,
    },
    selectedContainer: {
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors['blue-default'],
      backgroundColor: colors['blue-light1'],
    },
    itemFloor: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    floorLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    basicInfo: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    basicInfoF1: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    basicInfoF2: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    nftTypeBadge: {
      borderRadius: 2,
      borderStyle: 'solid',
      borderColor: colors['neutral-line'],
      borderWidth: 0.5,
      marginTop: 6,
      paddingVertical: 1,
      paddingHorizontal: 4,
      fontSize: 12,
      fontWeight: '400',
      color: colors['neutral-foot'],
    },
    floorRight: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      minWidth: 54,
      // ...makeDebugBorder('pink')
    },
    rowCenter: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    floorLabel: {
      color: colors['neutral-body'],
      fontSize: 13,
    },
    floorValue: {
      color: colors['neutral-body'],
      fontSize: 13,
      fontWeight: '600',
      position: 'relative',
    },
    floorValueWarn: {
      color: colors['orange-default'],
    },
    floorValueDanger: {
      color: colors['red-default'],
    },
    chainIcon: {
      marginRight: 6,
    },
    assetNameText: {
      color: colors['neutral-title1'],
      fontSize: 16,
      fontWeight: '600',
    },
    contractName: {
      color: colors['neutral-foot'],
      fontSize: 14,
      marginLeft: 6,
    },
    contractCheckbox: {
      marginLeft: 6,
      width: 20,
      height: 20,
    },
  };
});

const AssetsItemInList = React.memo(AssetsItemInListProto);

export default AssetsItemInList;
