import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import {
  type AssetApprovalItem,
  useFocusedApprovalOnApprovals,
  useRevokeAssetSpenders,
} from '../useApprovalsPage';

import { RcIconRightEntryCC, RcIconUnknown } from '../icons';
import { SelectionCheckbox, getSelectableContainerStyle } from './Layout';
import { ApprovalsLayouts } from '../layout';
import TouchableView from '@/components/Touchable/TouchableView';
import { AssetAvatar } from '@/components';
import { stringUtils } from '@rabby-wallet/base-utils';
import ApprovalNFTBadge from './NFTBadge';
import { checkoutApprovalSelection } from '../utils';

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
  assetApproval,
}: {
  assetApproval: AssetApprovalItem;
} & RNViewProps) {
  const { colors, styles } = useThemeStyles(getAssetsApprovalRowStyles);
  const { t } = useTranslation();

  const { toggleFocusedAssetItem } = useFocusedApprovalOnApprovals();

  const { assetRevokeMap, onSelectAllAsset } = useRevokeAssetSpenders();
  const { isSelectedAll, isSelectedPartials } = React.useMemo(() => {
    return checkoutApprovalSelection('assets', assetRevokeMap, assetApproval);
  }, [assetApproval, assetRevokeMap]);

  const { approvalInfo } = React.useMemo(() => {
    const approvalInfo = {
      nftType: null as null | 'collection' | 'nft',
      floor1Text: '',
      floor2Text: '',
      hasFloor2: false,
    };

    if (assetApproval?.type === 'nft') {
      // chainItem = findChainByServerID(asset?.chain as Chain['serverId']);
      approvalInfo.nftType = assetApproval.nftContract ? 'collection' : 'nft';
    }

    if (assetApproval?.type === 'token') {
      // approvalInfo.floor1Text = `${bizNumberUtils.splitNumberByStep(
      //   assetApproval.balance.toFixed(2),
      // )}`;
      approvalInfo.floor1Text = assetApproval?.name || '';
      // approvalInfo.floor2Text = assetApproval?.name || '';
    } else {
      approvalInfo.floor1Text = assetApproval?.nftToken
        ? stringUtils.ensureSuffix(
            assetApproval?.name || 'Unknown',
            ` #${assetApproval?.nftToken.inner_id}`,
          )
        : assetApproval?.name || 'Unknown';
    }

    approvalInfo.hasFloor2 =
      !!approvalInfo.floor2Text || !!approvalInfo.nftType;

    return {
      approvalInfo,
    };
  }, [assetApproval]);

  return (
    <TouchableView
      style={[
        styles.container,
        (isSelectedAll || isSelectedPartials) && styles.selectedContainer,
      ]}
      onPress={evt => {
        onSelectAllAsset(assetApproval, !isSelectedAll, 'final');
      }}>
      {/* floor 1 */}
      <View style={[styles.itemFloor, ContractFloorLayouts.floor1]}>
        <View style={styles.floorLeft}>
          {assetApproval?.logo_url ? (
            <AssetAvatar
              style={styles.chainIcon}
              logo={assetApproval?.logo_url}
              logoStyle={{ backgroundColor: colors['neutral-foot'] }}
              chain={assetApproval?.chain}
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
                style={[
                  styles.assetNameText,
                  { flexShrink: 1, maxWidth: '85%' },
                ]}
                ellipsizeMode="tail"
                numberOfLines={1}>
                {approvalInfo.floor1Text}
              </Text>
              <SelectionCheckbox
                isSelectedAll={isSelectedAll}
                isSelectedPartials={isSelectedPartials}
                style={styles.contractCheckbox}
              />
            </View>
            {approvalInfo.hasFloor2 && (
              <View style={styles.basicInfoF2}>
                {/* <Text style={styles.floor2Text}>{approvalInfo.floor2Text}</Text> */}
                {approvalInfo.nftType && (
                  <ApprovalNFTBadge type={approvalInfo.nftType} />
                )}
              </View>
            )}
          </View>
        </View>
        <RightTouchableView
          onPress={evt => {
            toggleFocusedAssetItem({ assetItem: assetApproval });
            evt.stopPropagation();
          }}>
          <Text style={styles.entryText}>{assetApproval.list.length}</Text>
          <RcIconRightEntryCC
            style={{ marginLeft: 4, top: 1 }}
            width={16}
            height={16}
            color={colors['neutral-foot']}
          />
        </RightTouchableView>
      </View>
    </TouchableView>
  );
}

export const getAssetsApprovalRowStyles = createGetStyles(colors => {
  const selectableStyles = getSelectableContainerStyle(colors);

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
      ...selectableStyles.container,
    },
    selectedContainer: {
      ...selectableStyles.selectedContainer,
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
      marginTop: 6,
    },
    floor2Text: {
      fontSize: 13,
      fontWeight: '400',
      color: colors['neutral-body'],
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

const ApprovalAssetRow = React.memo(AssetsApprovalRowProto);

export default ApprovalAssetRow;
