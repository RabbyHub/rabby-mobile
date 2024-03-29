import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { type AssetApprovalItem } from '../useApprovalsPage';

import {
  RcIconCheckedCC,
  RcIconRightEntryCC,
  RcIconUncheckCC,
  RcIconUnknown,
} from '../icons';
import { ApprovalsLayouts } from './Layout';
import TouchableView from '@/components/Touchable/TouchableView';
import { AssetAvatar } from '@/components';
import { stringUtils } from '@rabby-wallet/base-utils';
import ApprovalNFTBadge from './NFTBadge';

export const ContractFloorLayouts = {
  floor1: { height: 33, paddingTop: 0 },
  floor2: { height: 25, paddingTop: 5 },
  floor3: { height: 24, paddingTop: 4 },
};

function RightTouchableView({
  children,
  ...props
}: React.ComponentProps<typeof TouchableView>) {
  const { colors, styles } = useThemeStyles(getAssetsApprovalRowStyles);

  return (
    <TouchableView
      {...props}
      style={[styles.floorRight, { height: '100%' }, props.style]}>
      <View style={styles.rowCenter}>{children}</View>
    </TouchableView>
  );
}

function AssetsApprovalRowProto({
  approvalItem,
  listIndex,
  onPressArea,
}: {
  approvalItem: AssetApprovalItem;
  listIndex?: number;
  onPressArea?: (ctx: {
    type: 'selection' | 'entry' | 'trustValue' | 'revokeTrends';
    approvalItem: AssetApprovalItem;
  }) => void;
} & RNViewProps) {
  const { colors, styles } = useThemeStyles(getAssetsApprovalRowStyles);
  const { t } = useTranslation();

  const itemSelected = listIndex === 1;

  const { approvalInfo } = React.useMemo(() => {
    const approvalInfo = {
      nftType: null as null | 'collection' | 'nft',
      assetName: '',
      hasSubtitle: false,
    };

    if (approvalItem?.type === 'nft') {
      // chainItem = findChainByServerID(asset?.chain as Chain['serverId']);
      approvalInfo.nftType = approvalItem.nftContract ? 'collection' : 'nft';
      approvalInfo.hasSubtitle = true;
    }

    const assetChainServerId = approvalItem?.chain;

    approvalInfo.assetName =
      approvalItem?.type === 'nft' && approvalItem?.nftToken
        ? stringUtils.ensureSuffix(
            approvalItem?.name || 'Unknown',
            ` #${approvalItem?.nftToken.inner_id}`,
          )
        : approvalItem?.name || 'Unknown';

    const assetSubTitle = '';

    return {
      approvalInfo,
      assetChainServerId,
      assetSubTitle,
    };
  }, [approvalItem]);

  return (
    <TouchableView
      style={[styles.container, itemSelected && styles.selectedContainer]}
      onPress={evt => {
        onPressArea?.({ type: 'selection', approvalItem });
      }}>
      {/* floor 1 */}
      <View style={[styles.itemFloor, ContractFloorLayouts.floor1]}>
        <View style={styles.floorLeft}>
          {approvalItem?.logo_url ? (
            <AssetAvatar
              style={styles.chainIcon}
              logo={approvalItem?.logo_url}
              logoStyle={{ backgroundColor: colors['neutral-foot'] }}
              chain={approvalItem?.chain}
              chainIconPosition="tr"
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
                ellipsizeMode="tail"
                numberOfLines={1}>
                {approvalInfo.assetName}
              </Text>
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
            {approvalInfo.nftType && (
              <View style={styles.basicInfoF2}>
                <ApprovalNFTBadge type={approvalInfo.nftType} />
              </View>
            )}
          </View>
        </View>
        <RightTouchableView
          onPress={evt => {
            onPressArea?.({ type: 'entry', approvalItem });
          }}>
          <Text style={styles.entryText}>{approvalItem.list.length}</Text>
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

export const getAssetsApprovalRowStyles = createGetStyles(colors => {
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
      flexShrink: 1,
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

    floorRight: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      minWidth: 54,
      flexShrink: 0,
      // ...makeDebugBorder('pink')
    },
    entryText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors['neutral-title1'],
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
    chainIcon: { marginRight: 12 },
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

const ApprovalAssetsRow = React.memo(AssetsApprovalRowProto);

export default ApprovalAssetsRow;
