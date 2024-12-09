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
import { type ContractApprovalItem } from '../useApprovalsPage';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { findChainByServerID } from '@/utils/chain';
import { ellipsisAddress } from '@/utils/address';
import { SimulateUnderline } from '@/components/patches/Simulation';

import { RcIconUnknown } from '../icons';
import { getSelectableContainerStyle } from './Layout';
import { ApprovalsLayouts } from '../layout';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import RcIconWarning from '@/assets2024/icons/common/warning.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

export const ContractFloorLayouts = {
  floorHeader: { height: 33, paddingTop: 0 },
  floor1: { height: 24, paddingTop: 4 },
  floor2: { height: 24, paddingTop: 4 },
  floor3: { height: 24, paddingTop: 4 },
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
            borderColor: finalTextStyle['color'],
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

  return (
    <View
      style={[
        styles.container,
        styles.shadowButton,
        contract?.risk_alert ? styles.containerWithRisky : {},
        style,
      ]}>
      {/* floor header */}
      <View style={[styles.contractItemFloor, styles.header]}>
        <View style={styles.floorLeft}>
          {chainLogoUrl ? (
            <ChainIconImage
              containerStyle={styles.chainIcon}
              size={30}
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
          </View>
          <Text
            style={[styles.contractName]}
            ellipsizeMode="tail"
            numberOfLines={1}>
            {/* ({contract.name}{contract.name}{contract.name}{contract.name}{contract.name}) */}
            ({contract.name})
          </Text>
          <CopyAddressIcon
            address={contract.id}
            style={{ marginLeft: 2 }}
            color={colors2024['neutral-foot']}
          />
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
          <Text style={styles.floorLabel}>All Approvals</Text>
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
          <Text style={styles.floorLabel}>Contract Note</Text>
        </View>
        <Text
          style={[styles.floorValue]}
          ellipsizeMode="tail"
          numberOfLines={1}>
          {/* ({contract.name}{contract.name}{contract.name}{contract.name}{contract.name}) */}
          {contract.name}
        </Text>
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
            const hasRisk =
              revokeTrendsEvaluation.isDanger ||
              revokeTrendsEvaluation.isWarning;
            const modalId = createGlobalBottomSheetModal2024({
              name: MODAL_NAMES.DESCRIPTION,
              titleStyle: styles.modalTitle,
              sectionStyle: styles.section,
              bottomSheetModalProps: {
                enableDismissOnClose: true,
                snapPoints: [hasRisk ? '47%' : '34%'],
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
                    'page.approvals.tableConfig.byContracts.columnTip.revokeRecenet',
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
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const getCardStyles = createGetStyles2024(ctx => {
  const selectableStyles = getSelectableContainerStyle(ctx);
  const { colors2024 } = ctx;

  return {
    container: {
      borderRadius: 30,
      backgroundColor: colors2024['neutral-bg-1'],
      flexDirection: 'column',
      justifyContent: 'center',
      paddingHorizontal: ApprovalsLayouts.contractCardPaddingHorizontal,
      paddingVertical: 22,
      width: '100%',
      ...selectableStyles.container,
    },
    shadowButton: {
      shadowColor: colors2024['neutral-black'],
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.06,
      shadowRadius: 60,
      // elevation: 4,
    },
    containerWithRisky: {
      // height: ApprovalsLayouts.contractCardHeightWithRiskAlert,
      backgroundColor: colors2024['red-light-1'],
      borderColor: colors2024['red-light-2'],
    },
    selectedContainer: {
      ...selectableStyles.selectedContainer,
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
      fontSize: 17,
      fontWeight: '800',
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
      marginLeft: 6,
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
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
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
      color: colors2024['neutral-body'],
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      position: 'relative',
    },
    floorValueWarn: {
      color: colors2024['orange-default'],
    },
    floorValueDanger: {
      color: colors2024['red-dark'],
    },
    floorValueUnderlineDefault: {
      borderColor: 'transparent',
    },
    chainIcon: {
      marginRight: 6,
    },
    modalTitle: {
      marginTop: 12,
    },
    section: {
      marginTop: 20,
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
    skeletonBg: {
      backgroundColor: colors2024['neutral-bg-2'],
    },
  };
});

const ApprovalCardContract = React.memo(CardProto);

export default ApprovalCardContract;
