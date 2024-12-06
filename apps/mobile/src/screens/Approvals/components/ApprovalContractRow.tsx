import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { approvalUtils, bizNumberUtils } from '@rabby-wallet/biz-utils';

import {
  createGetStyles2024,
  makeDebugBorder,
  makeTriangleStyle,
} from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
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
import RcIconWarning from '@/assets2024/icons/common/warning.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

export const ContractFloorLayouts = {
  floorHeader: { paddingTop: 0 },
  floor2: { marginTop: 17 },
  floor3: { marginTop: 16 },
};

function RightTouchableView({
  children,
  ...props
}: React.ComponentProps<typeof TouchableView>) {
  const { styles } = useTheme2024({ getStyle: getCardStyles });

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
  const { styles, colors, colors2024 } = useTheme2024({
    getStyle: getCardStyles,
  });
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
        risky && styles.riskContainer,
        style,
      ]}
      onPress={() => {
        onSelectAllContractApprovals(contract, !isSelectedAll, 'final');
      }}>
      {/* floor header */}
      <View
        style={[styles.contractItemFloor, ContractFloorLayouts.floorHeader]}>
        <View style={styles.floorLeft}>
          <SelectionCheckbox
            isSelectedAll={isSelectedAll}
            isSelectedPartial={isSelectedPartial}
            style={styles.contractCheckbox}
            size={24}
          />
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
            color={colors2024['neutral-foot']}
          />
        </RightTouchableView>
      </View>

      {risky && (
        <View style={[styles.contractItemFloor, { marginTop: 7 }]}>
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

      {/* floor 2 */}
      <View style={[styles.contractItemFloor, ContractFloorLayouts.floor2]}>
        <View style={styles.floorLeft}>
          <Text style={styles.floorLabel}>
            {t(
              'page.approvals.tableConfig.byContracts.columnTitle.contractTrustValue',
            )}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            const modalId = createGlobalBottomSheetModal2024({
              name: MODAL_NAMES.DESCRIPTION,
              titleStyle: styles.modalTitle,
              sectionStyle: styles.section,
              bottomSheetModalProps: {
                enableDismissOnClose: true,
                snapPoints: ['40%'],
                enableContentPanningGesture: true,
                enablePanDownToClose: true,
              },
              title: trustValueEvalutation.isDanger
                ? t(
                    'page.approvals.tableConfig.byContracts.columnTip.contractTrustValueDanger',
                  )
                : trustValueEvalutation.isWarning
                ? t(
                    'page.approvals.tableConfig.byContracts.columnTip.contractTrustValueWarning',
                  )
                : t(
                    'page.approvals.tableConfig.byContracts.columnTip.normalTrustValueDanger',
                    {
                      contractUsdText,
                    },
                  ),
              sections: [
                {
                  description: t(
                    'page.approvals.tableConfig.byContracts.columnTip.contractTrustValue',
                  ),
                },
              ],
              nextButtonProps: {
                title: (
                  <Text style={styles.modalNextButtonText}>
                    {t(
                      'page.approvals.tableConfig.byContracts.columnTip.button',
                    )}
                  </Text>
                ),
                titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
                onPress: () => {
                  removeGlobalBottomSheetModal2024(modalId);
                },
              },
            });
          }}>
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
        </TouchableOpacity>
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
        <TouchableOpacity
          onPress={() => {
            const modalId = createGlobalBottomSheetModal2024({
              name: MODAL_NAMES.DESCRIPTION,
              titleStyle: styles.modalTitle,
              sectionStyle: styles.section,
              bottomSheetModalProps: {
                enableDismissOnClose: true,
                snapPoints: ['40%'],
                enableContentPanningGesture: true,
                enablePanDownToClose: true,
              },
              // TODO: is text correct from BD ?
              title: revokeTrendsEvaluation.isDanger
                ? t(
                    'page.approvals.tableConfig.byContracts.columnTip.revokeDangerTitle',
                  )
                : revokeTrendsEvaluation.isWarning
                ? t(
                    'page.approvals.tableConfig.byContracts.columnTip.revokeWarningTitle',
                  )
                : '',
              sections: [
                {
                  description: revokeTrendsEvaluation.isDanger
                    ? t(
                        'page.approvals.tableConfig.byContracts.columnTip.revokeTrendsValueDanger',
                      )
                    : revokeTrendsEvaluation.isWarning
                    ? t(
                        'page.approvals.tableConfig.byContracts.columnTip.revokeTrendsValueWarning',
                      )
                    : '',
                },
                {
                  description: t(
                    'page.approvals.tableConfig.byContracts.columnTip.revokeNewApproved',
                    {
                      count: contract.$riskAboutValues.approve_user_count,
                    },
                  ),
                },
                {
                  description: t(
                    'page.approvals.tableConfig.byContracts.columnTip.revokeNewApproved',
                    {
                      count: contract.$riskAboutValues.revoke_user_count,
                    },
                  ),
                },
              ].filter(i => !!i.description),
              nextButtonProps: {
                title: (
                  <Text style={styles.modalNextButtonText}>
                    {t(
                      'page.approvals.tableConfig.byContracts.columnTip.button',
                    )}
                  </Text>
                ),
                titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
                onPress: () => {
                  removeGlobalBottomSheetModal2024(modalId);
                },
              },
            });
          }}>
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
        </TouchableOpacity>
      </View>
    </TouchableView>
  );
}

export const getCardStyles = createGetStyles2024(ctx => {
  const { colors, colors2024 } = ctx;
  const selectableStyles = getSelectableContainerStyle(ctx);

  return {
    container: {
      borderRadius: 30,
      backgroundColor: colors2024['neutral-bg-1'],
      flexDirection: 'column',
      justifyContent: 'center',
      paddingHorizontal: ApprovalsLayouts.contractCardPaddingHorizontal,
      paddingVertical: ApprovalsLayouts.contractCardPaddingVertical,
      height: ApprovalsLayouts.contractRowHeight,
      width: '100%',
      ...selectableStyles.container,
    },
    riskContainer: {
      backgroundColor: colors2024['red-light-1'],
      borderColor: colors2024['red-light-2'],
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
      borderRadius: 12,
      paddingVertical: 7,
      paddingHorizontal: 15,
      backgroundColor: colors2024['red-light-2'],
      position: 'relative',
    },
    riskyTipArrow: {
      position: 'absolute',
      left: '20%',
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
    addrContractWrapper: {
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    contractAddrText: {
      color: colors2024['neutral-title-1'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    contractName: {
      color: colors2024['neutral-foot'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      maxWidth: 100,
    },
    contractNameInDetailModal: {
      maxWidth: 80,
    },
    contractCheckbox: {
      marginRight: 6,
    },
    rightOps: {
      flexShrink: 0,
    },
    entryText: {
      marginRight: 2,

      color: colors2024['neutral-title-1'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
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
      color: colors2024['neutral-secondary'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
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
    floorValue: {
      color: colors2024['neutral-foot'],
      fontSize: 14,
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      position: 'relative',
    },
    floorValueWarn: {
      color: colors2024['orange-default'],
    },
    floorValueDanger: {
      color: colors2024['red-default'],
    },
    floorValueUnderlineDefault: {
      borderColor: colors2024['neutral-line'],
    },
    chainIcon: {
      marginRight: 6,
    },
    modalNextButtonText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 24,
      textAlign: 'center',
      backgroundColor: colors2024['brand-default'],
      color: colors2024['neutral-InvertHighlight'],
    },
    modalTitle: {
      marginTop: 12,
    },
    section: {
      marginTop: 20,
    },
  };
});

const ApprovalContractRow = React.memo(CardProto);

export default ApprovalContractRow;
