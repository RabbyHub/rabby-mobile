import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { stringUtils } from '@rabby-wallet/base-utils';
import { approvalUtils, bizNumberUtils } from '@rabby-wallet/biz-utils';
import { NFTApproval } from '@rabby-wallet/rabby-api/dist/types';

import { AssetAvatar, Tip } from '@/components';
import NFTAvatar from '@/components/NFTAvatar';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024, useThemeStyles } from '@/hooks/theme';
import {
  getContractNFTType,
  maybeNFTLikeItem,
  checkoutContractSpender,
} from '../utils';

import {
  ContractApprovalItem,
  ToggleSelectApprovalSpenderCtx,
} from '../useApprovalsPage';
import ApprovalNFTBadge from './NFTBadge';
import { useTranslation } from 'react-i18next';
import { getTooltipContentStyles } from './Layout';
import Permit2Badge from './Permit2Badge';
import { RcIconNoCheck, RcIconHasCheckbox } from '@/assets/icons/common';
import { getTokenSymbol } from '@/utils/token';

function ApprovalAmountInfo({
  style,
  amountValue,
  balanceValue,
}: {
  amountValue: string | number;
  balanceValue: string | number;
} & RNViewProps) {
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle: getApprovalAmountStyles });
  const { styles: tooltipContentStyles } = useThemeStyles(
    getTooltipContentStyles,
  );

  const amountText = React.useMemo(() => {
    if (typeof amountValue !== 'number') return amountValue;

    return bizNumberUtils.formatNumber(amountValue);
  }, [amountValue]);

  const balanceText = React.useMemo(() => {
    if (typeof balanceValue !== 'number') return balanceValue;

    return bizNumberUtils.formatNumber(balanceValue);
  }, [balanceValue]);

  return (
    <View style={[styles.amountInfo, style]}>
      {amountText && (
        <View>
          <Tip
            isVisible={false}
            // Approved Amount
            content={
              <View style={[tooltipContentStyles.tipContent]}>
                <Text>
                  {t(
                    'page.approvals.tableConfig.byAssets.columnCell.approvedAmount.tipApprovedAmount',
                  )}
                </Text>
              </View>
            }
            placement="top"
            isLight>
            <View style={styles.textWrapper}>
              <Text style={[styles.approvalAmount]}>{amountText}</Text>
            </View>
          </Tip>
        </View>
      )}

      {balanceText && (
        <View>
          <Tip
            isVisible={false}
            // My Balance
            content={
              <Text>
                {t(
                  'page.approvals.tableConfig.byAssets.columnCell.approvedAmount.tipMyBalance',
                )}
              </Text>
            }
            placement="top"
            isLight>
            <View style={styles.textWrapper}>
              <Text style={[styles.approvalValues]}>{balanceText}</Text>
            </View>
          </Tip>
        </View>
      )}
    </View>
  );
}

const getApprovalAmountStyles = createGetStyles2024(
  ({ colors, colors2024 }) => {
    return {
      amountInfo: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
      },
      textWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        textAlign: 'right',
        width: '100%',
        // ...makeDebugBorder('yellow')
      },
      approvalAmount: {
        fontSize: 14,
        fontWeight: '400',
        color: colors2024['neutral-foot'],
        fontFamily: 'SF Pro Rounded',
        lineHeight: 18,
      },
      approvalValues: {
        fontSize: 14,
        fontWeight: '700',
        color: colors2024['neutral-title-1'],
        fontFamily: 'SF Pro Rounded',
        lineHeight: 18,
      },
    };
  },
);

export function InModalApprovalContractRow({
  style,
  approval,
  contractApproval,
  onToggleSelection,
  isSelected,
}: {
  approval: ContractApprovalItem;
  contractApproval: ContractApprovalItem['list'][number];
  onToggleSelection?: (
    ctx: ToggleSelectApprovalSpenderCtx & {
      approval: ContractApprovalItem;
      contractApproval: ContractApprovalItem['list'][number];
    },
  ) => void;
  isSelected: boolean;
} & RNViewProps) {
  const { colors, styles } = useTheme2024({
    getStyle: getApprovalContractRowStyles,
  });

  const { spender, associatedSpender } = React.useMemo(() => {
    return {
      spender: checkoutContractSpender(contractApproval),
      associatedSpender:
        '$indexderSpender' in contractApproval
          ? contractApproval.$indexderSpender
          : null,
    };
  }, [contractApproval]);

  const { itemName, maybeTokenInfo, maybeNFTInfo, spenderValues } =
    React.useMemo(() => {
      const maybeContractForNFT = maybeNFTLikeItem(contractApproval);

      const itemName = !maybeContractForNFT
        ? getTokenSymbol(contractApproval)
        : 'inner_id' in contractApproval
        ? stringUtils.ensureSuffix(
            contractApproval.contract_name || 'Unknown',
            ` #${contractApproval.inner_id}`,
          )
        : contractApproval.contract_name || 'Unknown';

      // non-token type contract

      const isToken = 'logo_url' in contractApproval;
      const maybeTokenInfo = {
        isToken,
        tokenLogoUrl: isToken ? contractApproval.logo_url : null,
      };

      const maybeNFTInfo = {
        nftBadgeType: !maybeContractForNFT
          ? null
          : getContractNFTType(contractApproval).nftBadgeType,
        nftImageURL:
          (contractApproval as NFTApproval)?.content ||
          ((contractApproval as any)?.collection?.logo_url as string),
      };

      const spenderValues = associatedSpender
        ? approvalUtils.getSpenderApprovalAmount(associatedSpender)
        : null;

      return {
        itemName,
        maybeTokenInfo,
        maybeNFTInfo,
        spender,
        spenderValues,
      };
    }, [contractApproval, spender, associatedSpender]);

  if (!spender) return null;

  return (
    <TouchableOpacity
      style={[styles.container, isSelected && styles.selectedContainer, style]}
      onPress={() => {
        onToggleSelection?.({ spender, approval, contractApproval });
      }}>
      <View style={styles.leftArea}>
        <View style={styles.itemCheckbox}>
          {isSelected ? (
            <RcIconHasCheckbox color={colors['blue-default']} />
          ) : (
            <RcIconNoCheck color={colors['neutral-line']} />
          )}
        </View>
        {maybeTokenInfo.isToken ? (
          <AssetAvatar
            style={styles.chainIcon}
            // pass empty if it's token as no logo_url to enforce the default logo
            logo={maybeTokenInfo.tokenLogoUrl || ''}
            logoStyle={{ backgroundColor: colors['neutral-foot'] }}
            chain={contractApproval?.chain}
            chainIconPosition="br"
            size={46}
            chainSize={16}
          />
        ) : (
          <NFTAvatar
            nftImageUrl={maybeNFTInfo.nftImageURL}
            style={styles.chainIcon}
            size={46}
          />
        )}

        <View style={styles.basicInfo}>
          <View style={styles.basicInfoF1}>
            <Text
              style={{
                ...styles.itemName,
                maxWidth: associatedSpender?.permit2_id ? 85 : 150,
              }}
              ellipsizeMode="tail"
              numberOfLines={1}>
              {itemName}
            </Text>
          </View>
          {maybeNFTInfo.nftBadgeType && (
            <View style={styles.basicInfoF2}>
              <ApprovalNFTBadge type={maybeNFTInfo.nftBadgeType} />
            </View>
          )}
        </View>
        {associatedSpender?.permit2_id && (
          <Permit2Badge style={styles.permit2} />
        )}
      </View>

      <View style={styles.rightArea}>
        <ApprovalAmountInfo
          style={{ flexShrink: 1 }}
          {...(spenderValues
            ? {
                amountValue: spenderValues.displayAmountText,
                balanceValue: spenderValues.displayBalanceText,
              }
            : {
                amountValue:
                  'amount' in contractApproval ? contractApproval.amount : '',
                balanceValue: '',
              })}
        />
      </View>
    </TouchableOpacity>
  );
}

const getApprovalContractRowStyles = createGetStyles2024(ctx => {
  const { colors2024, isLight } = ctx;

  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      borderRadius: 16,
    },
    selectedContainer: {},
    leftArea: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
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
    rightArea: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexShrink: 1,
    },
    itemName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      lineHeight: 20,
    },
    itemCheckbox: {
      marginRight: 12,
      width: 24,
      height: 24,
    },
    chainIcon: { marginRight: 12 },
    permit2: {
      marginLeft: 12,
    },
  };
});
