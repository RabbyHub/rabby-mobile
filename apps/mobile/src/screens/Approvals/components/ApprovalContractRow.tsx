import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  useFocusedApprovalOnApprovals,
  type ContractApprovalItem,
  useRevokeContractSpenders,
  useApprovalsPage,
} from '../useApprovalsPage';
import { RcIconRightEntryMiniCC, RcIconUnknown } from '../icons';
import { SelectionCheckbox, getSelectableContainerStyle } from './Layout';
import { parseApprovalSpenderSelection } from '../utils';
import RcIconWarning from '@/assets2024/icons/common/warning.svg';
import { HighlightText } from '@/components2024/HighlightText';
import { AssetAvatar } from '@/components';

export const ContractFloorLayouts = {
  floorHeader: { paddingTop: 0 },
  floor2: { marginTop: 16 },
  floor3: { marginTop: 16 },
};

function RightTouchableView({
  children,
  ...props
}: React.ComponentProps<typeof TouchableOpacity>) {
  const { styles } = useTheme2024({ getStyle: getCardStyles });

  return (
    <TouchableOpacity
      {...props}
      style={[styles.floorRight, { height: '100%' }, props.style]}>
      <View style={styles.rowCenter}>{children}</View>
    </TouchableOpacity>
  );
}

function CardProto({
  style,
  contract,
}: {
  contract: ContractApprovalItem;
} & RNViewProps) {
  const { styles, colors2024 } = useTheme2024({
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

  const { toggleFocusedContractItem } = useFocusedApprovalOnApprovals();

  const risky = useMemo(
    () => ['danger', 'warning'].includes(contract.risk_level),
    [contract.risk_level],
  );

  const { searchKw } = useApprovalsPage();

  useEffect(() => {
    let id;
    if (risky && contract && contract.list?.length) {
      id = setTimeout(() => {
        onSelectAllContractApprovals(contract, true, 'final');
      }, 0);
    }
    return () => {
      if (id) {
        clearTimeout(id);
      }
      if (risky && contract && contract.list?.length) {
        onSelectAllContractApprovals(contract, false, 'final');
      }
    };
  }, [contract, onSelectAllContractApprovals, risky, searchKw]);

  return (
    <TouchableOpacity
      style={[styles.container, risky && styles.riskContainer, style]}
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
          <AssetAvatar
            style={styles.chainIcon}
            size={46}
            chainSize={16}
            logo={contract.logo_url}
            chain={contract.chain}
            chainIconPosition="br"
            logoStyle={{ backgroundColor: colors2024['neutral-foot'] }}
          />

          <View style={styles.addrContractWrapper}>
            <HighlightText
              style={styles.contractName}
              highlightStyle={styles.highlightText}
              numberOfLines={1}
              searchWords={[searchKw]}
              textToHighlight={contract.name}
            />
          </View>
        </View>
        <RightTouchableView
          style={styles.rightOps}
          onPress={evt => {
            toggleFocusedContractItem({ contractItem: contract });
            evt.stopPropagation();
          }}>
          <Text style={styles.entryText}>
            {t('page.approvals.revokeModal.approvalCount', {
              count: contract.list.length,
            })}
          </Text>
          <RcIconRightEntryMiniCC
            width={14}
            height={14}
            color={colors2024['neutral-foot']}
          />
        </RightTouchableView>
      </View>

      {risky && (
        <View style={[styles.contractItemFloor, styles.riskRow]}>
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
    </TouchableOpacity>
  );
}

export const getCardStyles = createGetStyles2024(ctx => {
  const { colors2024, isLight } = ctx;
  const selectableStyles = getSelectableContainerStyle(ctx);

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
    },
    riskContainer: {
      backgroundColor: colors2024['red-light-1'],
      borderColor: colors2024['red-light-2'],
      shadowColor: colors2024['red-default'],
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.06,
      shadowRadius: 60,
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
    riskRow: {
      marginTop: 7,
      paddingHorizontal: 0,
      justifyContent: 'flex-start',
      flex: 1,
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
    riskyTip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      paddingVertical: 7,
      paddingHorizontal: 12,
      textAlign: 'center',
      backgroundColor: colors2024['red-light-2'],
      position: 'relative',
      flex: 1,
      marginTop: 6,
    },
    riskyTipArrow: {
      position: 'absolute',
      left: '40%',
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
    highlightText: {
      color: colors2024['brand-default'],
    },
    contractName: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    contractCheckbox: {
      marginRight: 8,
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
    rowCenter: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    chainIcon: {
      marginRight: 12,
    },
  };
});

const ApprovalContractRow = React.memo(CardProto);

export default ApprovalContractRow;
