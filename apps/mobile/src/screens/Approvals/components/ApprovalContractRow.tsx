import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { approvalUtils, bizNumberUtils } from '@rabby-wallet/biz-utils';

import {
  createGetStyles,
  makeDebugBorder,
  makeTriangleStyle,
} from '@/utils/styles';
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

import { RcIconRightEntryMiniCC, RcIconUnknown } from '../icons';
import { SelectionCheckbox, getSelectableContainerStyle } from './Layout';
import { ApprovalsLayouts } from '../layout';
import TouchableView from '@/components/Touchable/TouchableView';
import { parseApprovalSpenderSelection } from '../utils';
import { RcIconInfoCC } from '@/assets/icons/common';
import { Tip } from '@/components';

export const ContractFloorLayouts = {
  floorHeader: { paddingTop: 0 },
  floor2: { marginTop: 17 },
  floor3: { marginTop: 16 },
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
}: {
  contract: ContractApprovalItem;
  onPressArea?: (ctx: {
    type: 'selection' | 'entry' | 'trustValue' | 'revokeTrends';
    contract: ContractApprovalItem;
  }) => void;
} & RNViewProps) {
  const { colors, styles } = useThemeStyles(getCardStyles);
  const { t } = useTranslation();

  const { contractRevokeMap, onSelectAllContractApprovals } =
    useRevokeContractSpenders();

  const { isSelectedAll, isSelectedPartial } = React.useMemo(() => {
    return parseApprovalSpenderSelection(contract, 'contract', {
      curAllSelectedMap: contractRevokeMap,
    });
  }, [contractRevokeMap, contract]);

  const { revokeTrendsEvaluation, trustValueEvalutation } =
    React.useMemo(() => {
      const trustValue = (() => {
        const isDanger =
          contract.$contractRiskEvaluation.extra.clientSpendScore >=
          approvalUtils.RiskNumMap.danger;
        const isWarning =
          !isDanger &&
          contract.$contractRiskEvaluation.extra.clientSpendScore >=
            approvalUtils.RiskNumMap.warning;

        const isRisky = isDanger || isWarning;

        const finalTextStyle = StyleSheet.flatten([
          styles.floorValue,
          isWarning && styles.floorValueWarn,
          isDanger && styles.floorValueDanger,
        ]);
        const finalUnderlineStyle = StyleSheet.flatten([
          styles.floorValueUnderlineDefault,
          isRisky && {
            borderColor: finalTextStyle.color,
          },
        ]);

        return {
          isDanger,
          isWarning,
          isRisky,
          finalTextStyle,
          finalUnderlineStyle,
        };
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
        const finalUnderlineStyle = StyleSheet.flatten([
          styles.floorValueUnderlineDefault,
          isRisky && {
            borderColor: finalTextStyle.color,
          },
        ]);

        return {
          isDanger,
          isWarning,
          isRisky,
          finalTextStyle,
          finalUnderlineStyle,
        };
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

  const risky = useMemo(
    () => ['danger', 'warning'].includes(contract.risk_level),
    [contract.risk_level],
  );

  const contractUsdText = useMemo(
    () =>
      bizNumberUtils.formatUsdValue(
        contract.$riskAboutValues.risk_spend_usd_value || 0,
      ),
    [contract.$riskAboutValues.risk_spend_usd_value],
  );

  const isTreatedAsSelected = isSelectedAll || isSelectedPartial;

  return (
    <TouchableView
      style={[
        styles.container,
        contract?.risk_alert ? styles.containerWithRisky : {},
        isTreatedAsSelected && styles.selectedContainer,
        style,
      ]}
      onPress={() => {
        onSelectAllContractApprovals(contract, !isSelectedAll, 'final');
      }}>
      {/* floor header */}
      <View
        style={[styles.contractItemFloor, ContractFloorLayouts.floorHeader]}>
        <View style={styles.floorLeft}>
          {chainLogoUrl ? (
            <ChainIconImage
              containerStyle={styles.chainIcon}
              size={20}
              source={{ uri: chainLogoUrl }}
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
              style={[styles.contractName]}
              ellipsizeMode="tail"
              numberOfLines={1}>
              {/* ({contract.name}{contract.name}{contract.name}{contract.name}{contract.name}) */}
              ({contract.name})
            </Text>
          </View>
          <SelectionCheckbox
            isSelectedAll={isSelectedAll}
            isSelectedPartial={isSelectedPartial}
            style={styles.contractCheckbox}
          />
        </View>
        <RightTouchableView
          style={styles.rightOps}
          onPress={evt => {
            toggleFocusedContractItem({ contractItem: contract });
            evt.stopPropagation();
          }}>
          <Text style={styles.entryText}>{contract.list.length}</Text>
          <RcIconRightEntryMiniCC
            width={14}
            height={14}
            color={colors['neutral-foot']}
          />
        </RightTouchableView>
      </View>

      {risky && (
        <View style={[styles.contractItemFloor, { marginTop: 7 }]}>
          <View style={[styles.riskyTip]}>
            <RcIconInfoCC
              width={14}
              height={14}
              color={colors['neutral-title2']}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.riskyTipText}>{contract.risk_alert}</Text>

            <View style={styles.riskyTipArrow} />
          </View>
        </View>
      )}

      {/* floor 2 */}
      <View style={[styles.contractItemFloor, ContractFloorLayouts.floor2]}>
        <View style={styles.floorLeft}>
          <Text style={styles.floorLabel}>
            {t(
              'page.approvals.tableConfig.byContracts.columnTitle.contractTrustValue',
            )}
          </Text>
        </View>
        <Tip
          // {...(!trustValueEvalutation.isRisky && { isVisible: false })}
          contentStyle={[styles.riskyAlertTooltipContent]}
          content={
            <View style={[styles.riskyAlertTooltipInner]}>
              {trustValueEvalutation.isDanger && (
                <Text style={styles.riskyAlertTooltipText}>
                  {t(
                    'page.approvals.tableConfig.byContracts.columnTip.contractTrustValueDanger',
                  )}
                  {'\n'}
                </Text>
              )}
              {trustValueEvalutation.isWarning && (
                <Text style={styles.riskyAlertTooltipText}>
                  {t(
                    'page.approvals.tableConfig.byContracts.columnTip.contractTrustValueWarning',
                  )}
                  {'\n'}
                </Text>
              )}
              {!trustValueEvalutation.isRisky && (
                <Text style={styles.riskyAlertTooltipText}>
                  The contract trust value : {contractUsdText}
                  {'\n'}
                </Text>
              )}
              <Text style={styles.riskyAlertTooltipText}>
                {t(
                  'page.approvals.tableConfig.byContracts.columnTip.contractTrustValue',
                )}
              </Text>
            </View>
          }>
          <Text style={trustValueEvalutation.finalTextStyle}>
            {contractUsdText}
          </Text>
          <SimulateUnderline
            style={[
              {
                position: 'absolute',
                bottom: -1,
              },
              trustValueEvalutation.finalUnderlineStyle,
            ]}
          />
        </Tip>
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
        <Tip
          // {...(!revokeTrendsEvaluation.isRisky && { isVisible: false })}
          placement="top"
          contentStyle={[
            styles.riskyAlertTooltipContent,
            !revokeTrendsEvaluation.isRisky &&
              styles.riskyAlertTooltipContentForSafeRevokeTrend,
          ]}
          content={
            <View style={styles.riskyAlertTooltipInner}>
              {revokeTrendsEvaluation.isDanger && (
                <Text style={styles.riskyAlertTooltipText}>
                  {t(
                    'page.approvals.tableConfig.byContracts.columnTip.revokeTrendsValueDanger',
                  )}
                  {'\n'}
                </Text>
              )}
              {revokeTrendsEvaluation.isWarning && (
                <Text style={styles.riskyAlertTooltipText}>
                  {t(
                    'page.approvals.tableConfig.byContracts.columnTip.revokeTrendsValueWarning',
                  )}
                  {'\n'}
                </Text>
              )}
              <Text style={styles.riskyAlertTooltipText}>
                Newly approved users(24h):{' '}
                {contract.$riskAboutValues.approve_user_count}
                {'\n'}
                Recent revokes(24h):{' '}
                {contract.$riskAboutValues.revoke_user_count}
              </Text>
            </View>
          }>
          <Text style={revokeTrendsEvaluation.finalTextStyle}>
            {contract.$riskAboutValues.revoke_user_count}
          </Text>
          <SimulateUnderline
            style={[
              {
                position: 'absolute',
                bottom: -1,
              },
              revokeTrendsEvaluation.finalUnderlineStyle,
            ]}
            innerBg={!isTreatedAsSelected ? undefined : colors['blue-light1']}
          />
        </Tip>
      </View>
    </TouchableView>
  );
}

export const getCardStyles = createGetStyles(colors => {
  const selectableStyles = getSelectableContainerStyle(colors);

  return {
    container: {
      borderRadius: 8,
      backgroundColor: colors['neutral-card1'],
      flexDirection: 'column',
      justifyContent: 'center',
      paddingVertical: 10,
      height: ApprovalsLayouts.contractRowHeight,
      width: '100%',
      padding: ApprovalsLayouts.contractCardPadding,
      ...selectableStyles.container,
    },
    containerWithRisky: {
      height: ApprovalsLayouts.contractRowHeightWithRiskAlert,
    },
    selectedContainer: {
      ...selectableStyles.selectedContainer,
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
    riskyTip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      borderRadius: 6,
      padding: 8,
      backgroundColor: colors['red-default'],
      position: 'relative',
    },
    riskyTipArrow: {
      position: 'absolute',
      left: '20%',
      top: -7,
      ...makeTriangleStyle({
        dir: 'up',
        size: 12,
        color: colors['red-default'],
      }),
      borderTopWidth: 0,
      borderLeftWidth: 12,
      borderRightWidth: 12,
    },
    riskyTipText: {
      color: colors['neutral-title2'],
    },
    addrContractWrapper: {
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    contractAddrText: {
      color: colors['neutral-title1'],
      fontSize: 16,
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
      marginRight: 2,
    },
    approvalsCount: {
      fontSize: 14,
    },
    rowCenter: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    floorLabel: {
      color: colors['neutral-body'],
      fontSize: 15,
    },
    riskyAlertTooltipContent: {
      borderRadius: 2,
      minHeight: 96,
      maxHeight: 128,
      width: 296,
      maxWidth: ApprovalsLayouts.riskAlertTooltipMaxWidth,
    },
    riskyAlertTooltipContentForSafeRevokeTrend: {
      minWidth: 220,
      height: 48,
      minHeight: 48,
    },
    riskyAlertTooltipInner: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    riskyAlertTooltipText: {
      color: colors['neutral-title2'],
      fontSize: 13,
      fontWeight: '400',
    },
    floorValue: {
      color: colors['neutral-title1'],
      fontSize: 15,
      fontWeight: '600',
      position: 'relative',
    },
    floorValueWarn: {
      color: colors['orange-default'],
    },
    floorValueDanger: {
      color: colors['red-default'],
    },
    floorValueUnderlineDefault: {
      borderColor: colors['neutral-line'],
    },
    chainIcon: {
      marginRight: 6,
    },
  };
});

const ApprovalContractRow = React.memo(CardProto);

export default ApprovalContractRow;
