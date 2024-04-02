import React from 'react';
import { View, Text } from 'react-native';

import { stringUtils } from '@rabby-wallet/base-utils';
import { approvalUtils, bizNumberUtils } from '@rabby-wallet/biz-utils';
import { NFTApproval } from '@rabby-wallet/rabby-api/dist/types';

import { AssetAvatar, Tip } from '@/components';
import NFTAvatar from '@/components/NFTAvatar';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import {
  checkoutContractSpender,
  getContractNFTType,
  querySelectedContractSpender,
  maybeNFTLikeItem,
  encodeApprovalSpenderKey,
} from '../utils';

import {
  ContractApprovalItem,
  ToggleSelectApprovalSpenderCtx,
  useRevokeApprovals,
} from '../useApprovalsPage';
import { RcIconCheckedCC, RcIconUncheckCC } from '../icons';
import ApprovalNFTBadge from './NFTBadge';
import { useTranslation } from 'react-i18next';
import { getTooltipContentStyles } from './Layout';
import TouchableView from '@/components/Touchable/TouchableView';

function ApprovalAmountInfo({
  style,
  amountValue,
  balanceValue,
}: {
  amountValue: string | number;
  balanceValue: string | number;
} & RNViewProps) {
  const { t } = useTranslation();

  const { styles } = useThemeStyles(getApprovalAmountStyles);
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

const getApprovalAmountStyles = createGetStyles(colors => {
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
      fontSize: 13,
      fontWeight: '600',
      color: colors['neutral-body'],
    },
    approvalValues: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '400',
      color: colors['neutral-foot'],
    },
  };
});

export function InModalApprovalContractRow({
  style,
  approval,
  contractApproval,
  onToggleSelection,
}: {
  approval: ContractApprovalItem;
  contractApproval: ContractApprovalItem['list'][number];
  onToggleSelection?: (
    ctx: ToggleSelectApprovalSpenderCtx & {
      approval: ContractApprovalItem;
      contractApproval: ContractApprovalItem['list'][number];
    },
  ) => void;
} & RNViewProps) {
  const { colors, styles } = useThemeStyles(getApprovalContractRowStyles);

  const { contractRevokeMap } = useRevokeApprovals();
  const { spender, isSelected } = React.useMemo(() => {
    const spender = checkoutContractSpender(contractApproval);

    return {
      spender,
      isSelected: !!querySelectedContractSpender(
        contractRevokeMap,
        approval,
        contractApproval,
      ),
    };
  }, [contractRevokeMap, approval, contractApproval]);

  const { itemName, maybeTokenInfo, maybeNFTInfo, spenderValues } =
    React.useMemo(() => {
      const maybeContractForNFT = maybeNFTLikeItem(contractApproval);

      const itemName = !maybeContractForNFT
        ? contractApproval.symbol
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

      const spenderValues = spender
        ? approvalUtils.getSpenderApprovalAmount(spender)
        : null;

      return {
        itemName,
        maybeTokenInfo,
        maybeNFTInfo,
        spender,
        spenderValues,
      };
    }, [contractApproval, spender]);

  if (!spender) return null;

  return (
    <TouchableView
      style={[styles.container, style]}
      onPress={() => {
        onToggleSelection?.({ spender, approval, contractApproval });
      }}>
      <View style={styles.leftArea}>
        {maybeTokenInfo.isToken ? (
          <AssetAvatar
            style={styles.chainIcon}
            // pass empty if it's token as no logo_url to enforce the default logo
            logo={maybeTokenInfo.tokenLogoUrl || ''}
            logoStyle={{ backgroundColor: colors['neutral-foot'] }}
            chain={contractApproval?.chain}
            chainIconPosition="tr"
            size={28}
            chainSize={16}
          />
        ) : (
          <NFTAvatar
            nftImageUrl={maybeNFTInfo.nftImageURL}
            style={styles.chainIcon}
            size={28}
          />
        )}

        <View style={styles.basicInfo}>
          <View style={styles.basicInfoF1}>
            <Text
              style={styles.itemName}
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
        {isSelected ? (
          <RcIconCheckedCC
            style={styles.itemCheckbox}
            color={colors['blue-default']}
          />
        ) : (
          <RcIconUncheckCC
            style={styles.itemCheckbox}
            color={colors['neutral-line']}
          />
        )}
      </View>
    </TouchableView>
  );
}

const getApprovalContractRowStyles = createGetStyles(colors => {
  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 8,
      padding: 8,
      backgroundColor: colors['neutral-card1'],
      height: 60,
    },
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
      fontWeight: '500',
      color: colors['neutral-title1'],
    },
    itemCheckbox: {
      marginLeft: 16,
      width: 24,
      height: 24,
    },
    chainIcon: { marginRight: 12 },
  };
});
