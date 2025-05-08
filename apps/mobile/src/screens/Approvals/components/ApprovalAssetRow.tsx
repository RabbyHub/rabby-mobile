import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  type AssetApprovalItem,
  useApprovalsPage,
  useFocusedApprovalOnApprovals,
  useRevokeAssetSpenders,
} from '../useApprovalsPage';
import { RcIconRightEntryMiniCC, RcIconUnknown } from '../icons';
import { SelectionCheckbox } from './Layout';
import { AssetAvatar } from '@/components';
import { stringUtils } from '@rabby-wallet/base-utils';
import ApprovalNFTBadge from './NFTBadge';
import { parseApprovalSpenderSelection } from '../utils';
import { HighlightText } from '@/components2024/HighlightText';
import { useTranslation } from 'react-i18next';

export const ContractFloorLayouts = {
  floor1: { height: 33, paddingTop: 0 },
  floor2: { height: 25, paddingTop: 5 },
  floor3: { height: 24, paddingTop: 4 },
};

function RightTouchableView({
  children,
  ...props
}: React.ComponentProps<typeof TouchableOpacity>) {
  const { styles } = useTheme2024({
    getStyle: getAssetsApprovalRowStyles,
  });

  return (
    <TouchableOpacity
      {...props}
      style={[styles.floorRight, { height: '100%' }, props.style]}>
      <View style={styles.rowCenter}>{children}</View>
    </TouchableOpacity>
  );
}

function AssetsApprovalRowProto({
  assetApproval,
}: {
  assetApproval: AssetApprovalItem;
} & RNViewProps) {
  const { t } = useTranslation();
  const { colors, styles, colors2024 } = useTheme2024({
    getStyle: getAssetsApprovalRowStyles,
  });

  const { toggleFocusedAssetItem } = useFocusedApprovalOnApprovals();

  const { searchKw } = useApprovalsPage();

  const { assetRevokeMap, onSelectAllAsset } = useRevokeAssetSpenders();
  const { isSelectedAll, isSelectedPartial } = React.useMemo(() => {
    return parseApprovalSpenderSelection(assetApproval, 'assets', {
      curAllSelectedMap: assetRevokeMap,
    });
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
    <TouchableOpacity
      style={[
        styles.container,
        (isSelectedAll || isSelectedPartial) && styles.selectedContainer,
      ]}
      onPress={evt => {
        onSelectAllAsset(assetApproval, !isSelectedAll, 'final');
      }}>
      {/* floor 1 */}
      <View style={[styles.itemFloor, ContractFloorLayouts.floor1]}>
        <View style={styles.floorLeft}>
          <SelectionCheckbox
            isSelectedAll={isSelectedAll}
            isSelectedPartial={isSelectedPartial}
            style={styles.contractCheckbox}
            size={24}
          />
          <View style={styles.basicInfo}>
            <View style={styles.basicInfoF1}>
              <AssetAvatar
                style={styles.chainIcon}
                logo={assetApproval?.logo_url}
                logoStyle={{ backgroundColor: colors2024['neutral-foot'] }}
                chain={assetApproval?.chain}
                chainIconPosition="br"
                size={46}
                chainSize={16}
              />
            </View>
          </View>
        </View>
        <View style={styles.title}>
          <HighlightText
            style={[styles.assetNameText, { flexShrink: 1 }]}
            highlightStyle={styles.highlightText}
            numberOfLines={1}
            searchWords={[searchKw]}
            textToHighlight={approvalInfo.floor1Text}
          />
          {approvalInfo.hasFloor2 && (
            <View style={styles.basicInfoF2}>
              {/* <Text style={styles.floor2Text}>{approvalInfo.floor2Text}</Text> */}
              {approvalInfo.nftType && (
                <ApprovalNFTBadge type={approvalInfo.nftType} />
              )}
            </View>
          )}
        </View>
        <RightTouchableView
          onPress={evt => {
            toggleFocusedAssetItem({ assetItem: assetApproval });
            evt.stopPropagation();
          }}>
          <Text style={styles.entryText}>
            {t('page.approvals.revokeModal.approvalCount', {
              count: assetApproval.list.length,
            })}
          </Text>
          <RcIconRightEntryMiniCC
            width={14}
            height={14}
            color={colors2024['neutral-foot']}
          />
        </RightTouchableView>
      </View>
    </TouchableOpacity>
  );
}

export const getAssetsApprovalRowStyles = createGetStyles2024(ctx => {
  const { colors, colors2024, isLight } = ctx;

  return {
    container: {
      borderRadius: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      flexDirection: 'column',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      width: '100%',
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: 'transparent',
      height: 74,
    },
    selectedContainer: {
      backgroundColor: colors2024['brand-light-1'],
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
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
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
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    highlightText: {
      color: colors2024['brand-default'],
    },

    contractCheckbox: {
      marginRight: 12,
      width: 20,
      height: 20,
    },
    title: {
      flex: 1,
      height: 50,
      justifyContent: 'center',
    },
  };
});

const ApprovalAssetRow = React.memo(AssetsApprovalRowProto);

export default ApprovalAssetRow;
