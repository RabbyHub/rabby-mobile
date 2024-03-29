import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { approvalUtils, bizNumberUtils } from '@rabby-wallet/biz-utils';

import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import {
  useFocusedApprovalOnApprovals,
  type ContractApprovalItem,
} from '../useApprovalsPage';
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
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';

export const ContractFloorLayouts = {
  floor1: { height: 33, paddingTop: 0 },
  floor2: { height: 25, paddingTop: 5 },
  floor3: { height: 24, paddingTop: 4 },
};

function RightTouchableView({
  children,
  ...props
}: React.ComponentProps<typeof TouchableView>) {
  const { colors, styles } = useThemeStyles(getCardStyles);

  return (
    <TouchableView
      {...props}
      style={[styles.floorRight, { height: '100%' }, props.style]}>
      <View style={styles.rowCenter}>{children}</View>
    </TouchableView>
  );
}

function CardProto({
  style,
  contract,
  listIndex,
  onPressArea,
  inDetailModal = false,
}: {
  contract: ContractApprovalItem;
  listIndex?: number;
  onPressArea?: (ctx: {
    type: 'selection' | 'entry' | 'trustValue' | 'revokeTrends';
    contract: ContractApprovalItem;
  }) => void;
  inDetailModal?: boolean;
} & RNViewProps) {
  const { colors, styles } = useThemeStyles(getCardStyles);
  const { t } = useTranslation();

  if (listIndex === 0) {
    console.log('CardProto:: contract.logo_url', contract.logo_url);
  }

  const itemSelected = listIndex === 1;

  const { revokeTrendsEvaluation, trustValueEvalutation } =
    React.useMemo(() => {
      const trustValue = (() => {
        const isDanger =
          contract.$contractRiskEvaluation.extra.clientExposureScore >=
          approvalUtils.RiskNumMap.danger;
        const isWarning =
          !isDanger &&
          contract.$contractRiskEvaluation.extra.clientExposureScore >=
            approvalUtils.RiskNumMap.warning;

        const isRisky = isDanger || isWarning;

        const finalTextStyle = StyleSheet.flatten([
          styles.floorValue,
          isWarning && styles.floorValueWarn,
          isDanger && styles.floorValueDanger,
        ]);

        return { isDanger, isWarning, isRisky, finalTextStyle };
      })();

      const revokeTrends = (() => {
        const isDanger =
          contract.$contractRiskEvaluation.extra.clientApprovalScore >=
          approvalUtils.RiskNumMap.danger;
        const isWarning =
          !isDanger &&
          contract.$contractRiskEvaluation.extra.clientApprovalScore >=
            approvalUtils.RiskNumMap.warning;

        const isRisky = isDanger || isWarning;

        const finalTextStyle = StyleSheet.flatten([
          styles.floorValue,
          isWarning && styles.floorValueWarn,
          isDanger && styles.floorValueDanger,
        ]);

        return { isDanger, isWarning, isRisky, finalTextStyle };
      })();

      return {
        trustValueEvalutation: trustValue,
        revokeTrendsEvaluation: revokeTrends,
      };
    }, [contract, styles]);

  const chainItem = useMemo(
    () => findChainByServerID(contract.chain),
    [contract.chain],
  );
  const chainLogoUrl = chainItem?.logo || contract.logo_url;

  const { toggleFocusedContractItem } = useFocusedApprovalOnApprovals();

  return (
    <TouchableView
      disabled={inDetailModal}
      style={[
        styles.container,
        !inDetailModal && itemSelected && styles.selectedContainer,
        style,
      ]}
      onPress={evt => {
        onPressArea?.({ type: 'selection', contract });
      }}>
      {/* floor 1 */}
      <View style={[styles.contractItemFloor, ContractFloorLayouts.floor1]}>
        <View style={styles.floorLeft}>
          {chainLogoUrl ? (
            <ChainIconImage
              style={styles.chainIcon}
              size={20}
              {...(contract.logo_url && {
                source: { uri: chainLogoUrl },
              })}
            />
          ) : (
            <RcIconUnknown style={styles.chainIcon} />
          )}
          <Text
            style={styles.contractAddrText}
            ellipsizeMode="tail"
            numberOfLines={1}>
            {ellipsisAddress(contract.id)}
          </Text>
          <Text
            style={styles.contractName}
            ellipsizeMode="tail"
            numberOfLines={1}>
            ({contract.name})
          </Text>
          {!inDetailModal ? (
            itemSelected ? (
              <RcIconCheckedCC
                style={styles.contractCheckbox}
                color={colors['blue-default']}
              />
            ) : (
              <RcIconUncheckCC
                style={styles.contractCheckbox}
                color={colors['neutral-line']}
              />
            )
          ) : (
            <CopyAddressIcon
              address={contract.id}
              style={{ marginLeft: 2 }}
              color={colors['neutral-foot']}
            />
          )}
        </View>
        <RightTouchableView
          disabled={inDetailModal}
          onPress={evt => {
            if (inDetailModal) return;
            toggleFocusedContractItem(contract);
            evt.stopPropagation();
          }}>
          {!inDetailModal ? (
            <>
              <Text style={styles.entryText}>{contract.list.length}</Text>
              <RcIconRightEntryCC
                width={14}
                height={14}
                color={colors['neutral-foot']}
              />
            </>
          ) : (
            <>
              <Text style={styles.entryText}>
                {contract.list.length} Approvals
              </Text>
            </>
          )}
        </RightTouchableView>
      </View>

      {/* floor 2 */}
      <View style={[styles.contractItemFloor, ContractFloorLayouts.floor2]}>
        <View style={styles.floorLeft}>
          <Text style={styles.floorLabel}>
            {t(
              'page.approvals.tableConfig.byContracts.columnTitle.contractTrustValue',
            )}
          </Text>
        </View>
        <RightTouchableView
          disabled={!trustValueEvalutation.isRisky}
          style={[styles.floorRight, { height: '100%' }]}
          onPress={evt => {
            if (!trustValueEvalutation.isRisky) return;

            evt?.stopPropagation();
            __DEV__ && toast.show('[Debug] Pressed Trust Value');
            onPressArea?.({ type: 'trustValue', contract });
          }}>
          <Text style={trustValueEvalutation.finalTextStyle}>
            {bizNumberUtils.formatUsdValue(
              contract.$riskAboutValues.risk_exposure_usd_value || 0,
            )}
          </Text>
          {trustValueEvalutation.isRisky && (
            <SimulateUnderline
              style={[
                {
                  position: 'absolute',
                  bottom: -1,
                  borderColor: trustValueEvalutation.finalTextStyle['color'],
                },
              ]}
            />
          )}
        </RightTouchableView>
      </View>

      {/* floor 3 */}
      <View style={[styles.contractItemFloor, ContractFloorLayouts.floor3]}>
        <View style={styles.floorLeft}>
          <Text style={styles.floorLabel}>
            {t(
              'page.approvals.tableConfig.byContracts.columnTitle.revokeTrends',
            )}
          </Text>
        </View>
        <RightTouchableView
          disabled={!revokeTrendsEvaluation.isRisky}
          style={[styles.floorRight, { height: '100%' }]}
          onPress={evt => {
            if (!revokeTrendsEvaluation.isRisky) return;

            evt?.stopPropagation();
            __DEV__ && toast.show('[Debug] Pressed Revoke Trends in 24 hours');
            onPressArea?.({ type: 'revokeTrends', contract });
          }}>
          <Text style={revokeTrendsEvaluation.finalTextStyle}>
            {contract.$riskAboutValues.revoke_user_count}
          </Text>
          {revokeTrendsEvaluation.isRisky && (
            <SimulateUnderline
              style={[
                {
                  position: 'absolute',
                  bottom: -1,
                  borderColor: revokeTrendsEvaluation.finalTextStyle['color'],
                },
              ]}
            />
          )}
        </RightTouchableView>
      </View>
    </TouchableView>
  );
}

export const getCardStyles = createGetStyles(colors => {
  return {
    container: {
      borderRadius: 8,
      backgroundColor: colors['neutral-card1'],
      flexDirection: 'column',
      justifyContent: 'center',
      paddingVertical: 10,
      height: ApprovalsLayouts.contractCardHeight,
      width: '100%',
      padding: ApprovalsLayouts.contractCardPadding,
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
    contractItemFloor: {
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
    floorRight: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      minWidth: 54,
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
    chainIcon: {
      marginRight: 6,
    },
    contractAddrText: {
      color: colors['neutral-title1'],
      fontSize: 14,
      fontWeight: '500',
    },
    contractName: {
      color: colors['neutral-foot'],
      fontSize: 14,
      fontWeight: '400',
      marginLeft: 6,
    },
    contractCheckbox: {
      marginLeft: 6,
      width: 20,
      height: 20,
    },
  };
});

const ApprovalContractCard = React.memo(CardProto);

export default ApprovalContractCard;
