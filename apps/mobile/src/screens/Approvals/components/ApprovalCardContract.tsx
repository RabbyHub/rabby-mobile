import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { type ContractApprovalItem } from '../useApprovalsPage';
import { findChainByServerID } from '@/utils/chain';
import { ellipsisAddress } from '@/utils/address';
import { RcIconUnknown } from '../icons';
import { getSelectableContainerStyle } from './Layout';
import RcIconWarning from '@/assets2024/icons/common/warning.svg';
import { AssetAvatar } from '@/components';
import { default as RcIconExternalLink2CC } from '@/assets/icons/common/external-link-2-cc.svg';
import { openNFTLinkFromChainItem } from '../utils';

export const ContractFloorLayouts = {
  floor1: { height: 18, paddingTop: 0 },
};

function CardProto({
  style,
  contract,
  onPressArea,
}: {
  contract: ContractApprovalItem;
  onPressArea?: (ctx: {
    type: 'selection' | 'entry' | 'trustValue' | 'revokeTrends';
    contract: ContractApprovalItem;
  }) => void;
} & RNViewProps) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getCardStyles,
  });
  const { t } = useTranslation();

  const chainItem = React.useMemo(
    () => findChainByServerID(contract.chain),
    [contract.chain],
  );

  const risky = useMemo(
    () => ['danger', 'warning'].includes(contract.risk_level),
    [contract.risk_level],
  );

  return (
    <View
      style={[
        styles.container,
        contract?.risk_alert ? styles.containerWithRisky : {},
        style,
      ]}>
      {/* floor header */}
      <View style={[styles.contractItemFloor, styles.header]}>
        <View style={styles.title}>
          <AssetAvatar
            style={styles.chainIcon}
            size={46}
            chainSize={16}
            logo={contract.logo_url}
            chain={contract.chain}
            chainIconPosition="br"
            logoStyle={{ backgroundColor: colors2024['neutral-foot'] }}
          />

          <Text
            style={[styles.contractName]}
            ellipsizeMode="tail"
            numberOfLines={1}>
            {contract.name}
          </Text>
        </View>
      </View>

      {risky && (
        <View style={[styles.contractItemFloor, styles.riskContainer]}>
          <View style={[styles.riskyTip]}>
            <RcIconWarning
              width={11}
              height={11}
              color={colors2024['red-default']}
              style={{ marginRight: 3 }}
            />
            <Text style={styles.riskyTipText}>{contract.risk_alert}</Text>

            <View style={styles.riskyTipArrow} />
          </View>
        </View>
      )}

      <View style={[styles.divider, risky && styles.dangerDivider]} />

      {/* floor 0 */}
      <View style={[styles.contractItemFloor, ContractFloorLayouts.floor1]}>
        <View style={styles.floorLeft}>
          <Text style={styles.floorLabel}>
            {t('page.approvals.allApprovals')}
          </Text>
        </View>
        <Text
          style={[styles.floorValue]}
          ellipsizeMode="tail"
          numberOfLines={1}>
          {contract.list.length}
        </Text>
      </View>

      {/* floor 1 */}
      <View style={[styles.contractItemFloor, ContractFloorLayouts.floor1]}>
        <View style={styles.floorLeft}>
          <Text style={styles.floorLabel}>
            {t('page.approvals.contractAddress')}
          </Text>
        </View>
        <View style={styles.floorRight}>
          <Text
            style={[styles.floorValue]}
            ellipsizeMode="tail"
            numberOfLines={1}>
            {ellipsisAddress(contract.id)}
          </Text>
          <TouchableOpacity
            onPress={() => openNFTLinkFromChainItem(chainItem, contract.id)}>
            <RcIconExternalLink2CC
              style={styles.externalIcon}
              color={colors2024['neutral-foot']}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export const getCardStyles = createGetStyles2024(ctx => {
  const selectableStyles = getSelectableContainerStyle(ctx);
  const { colors2024, isLight } = ctx;

  return {
    container: {
      borderRadius: 20,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      flexDirection: 'column',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      width: '100%',
      ...selectableStyles.container,
    },
    title: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      textAlign: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    containerWithRisky: {
      // height: ApprovalsLayouts.contractCardHeightWithRiskAlert,
      backgroundColor: colors2024['red-light-1'],
      borderColor: colors2024['red-light-2'],
    },
    contractItemFloor: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: 12,
    },
    header: {
      marginTop: 0,
    },
    riskContainer: {
      marginTop: 5,
    },
    divider: {
      height: 1,
      marginBottom: 4,
      marginTop: 16,
      backgroundColor: colors2024['neutral-line'],
    },
    dangerDivider: {
      backgroundColor: colors2024['red-light-1'],
    },
    floorLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexShrink: 1,
    },
    floorRight: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      minWidth: 54,
      // ...makeDebugBorder('pink')
    },
    riskyTip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingVertical: 7,
      paddingHorizontal: 15,
      backgroundColor: colors2024['red-light-2'],
      position: 'relative',
      flex: 1,
      marginTop: 2,
    },
    riskyTipArrow: {
      position: 'absolute',
      left: '50%',
      top: -6,
      ...makeTriangleStyle({
        dir: 'up',
        size: 6,
        color: colors2024['red-light-2'],
      }),
      borderTopWidth: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
    },
    riskyTipText: {
      color: colors2024['red-default'],
      fontSize: 12,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    contractName: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      marginLeft: 2,
    },
    floorLabel: {
      color: colors2024['neutral-secondary'],
      fontWeight: '500',
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
    },
    floorValue: {
      color: colors2024['neutral-body'],
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      position: 'relative',
      lineHeight: 18,
    },
    chainIcon: {
      marginRight: 6,
    },
    skeletonBg: {
      backgroundColor: colors2024['neutral-bg-2'],
    },
    externalIcon: { marginLeft: 4 },
  };
});

const ApprovalCardContract = React.memo(CardProto);

export default ApprovalCardContract;
