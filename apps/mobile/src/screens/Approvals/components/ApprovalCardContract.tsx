import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { approvalUtils, bizNumberUtils } from '@rabby-wallet/biz-utils';

import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import {
  useFocusedApprovalOnApprovals,
  type ContractApprovalItem,
  useRevokeContractSpenders,
} from '../useApprovalsPage';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { findChainByServerID } from '@/utils/chain';
import { ellipsisAddress } from '@/utils/address';
import { SimulateUnderline } from '@/components/patches/Simulation';

import { RcIconRightEntryCC, RcIconUnknown } from '../icons';
import { ApprovalsLayouts, SelectionCheckbox } from './Layout';
import TouchableView from '@/components/Touchable/TouchableView';
import { toast } from '@/components/Toast';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
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
  onPressArea,
  inDetailModal = false,
}: {
  contract: ContractApprovalItem;
  onPressArea?: (ctx: {
    type: 'selection' | 'entry' | 'trustValue' | 'revokeTrends';
    contract: ContractApprovalItem;
  }) => void;
  inDetailModal?: boolean;
} & RNViewProps) {
  const { colors, styles } = useThemeStyles(getCardStyles);
  const { t } = useTranslation();

  const { contractRevokeMap, onSelectAllContractApprovals } =
    useRevokeContractSpenders();

  const { isSelectedAll, isSelectedPartials } = React.useMemo(() => {
    return checkoutApprovalSelection(contractRevokeMap, contract);
  }, [contractRevokeMap, contract]);

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
        !inDetailModal &&
          (isSelectedAll || isSelectedPartials) &&
          styles.selectedContainer,
        style,
      ]}
      onPress={() => {
        if (!inDetailModal) {
          onSelectAllContractApprovals(contract, !isSelectedAll);
        }
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
          <View style={styles.addrContractWrapper}>
            <Text
              style={styles.contractAddrText}
              ellipsizeMode="tail"
              numberOfLines={1}>
              {ellipsisAddress(contract.id)}
            </Text>
            <Text
              style={[
                styles.contractName,
                inDetailModal && styles.contractNameInDetailModal,
              ]}
              ellipsizeMode="tail"
              numberOfLines={1}>
              {/* ({contract.name}{contract.name}{contract.name}{contract.name}{contract.name}) */}
              ({contract.name})
            </Text>
          </View>
          {!inDetailModal ? (
            <SelectionCheckbox
              isSelectedAll={isSelectedAll}
              isSelectedPartials={isSelectedPartials}
              style={styles.contractCheckbox}
            />
          ) : (
            <CopyAddressIcon
              address={contract.id}
              style={{ marginLeft: 2 }}
              color={colors['neutral-foot']}
            />
          )}
        </View>
        <RightTouchableView
          style={styles.rightOps}
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
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors['neutral-card1'],
    },
    selectedContainer: {
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
      flexShrink: 1,
    },
    floorRight: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      minWidth: 54,
      // ...makeDebugBorder('pink')
    },
    addrContractWrapper: {
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
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
      maxWidth: 100,
    },
    contractNameInDetailModal: {
      maxWidth: 80,
    },
    contractCheckbox: {
      marginLeft: 6,
    },
    rightOps: {
      flexShrink: 0,
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
  };
});

const ApprovalCardContract = React.memo(CardProto);

export default ApprovalCardContract;
