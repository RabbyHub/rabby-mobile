import React from 'react';
import { View, Text } from 'react-native';

import { approvalUtils, bizNumberUtils } from '@rabby-wallet/biz-utils';

import { AssetAvatar, Tip } from '@/components';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';

import {
  AssetApprovalItem,
  ToggleSelectApprovalSpenderCtx,
  useRevokeApprovals,
} from '../useApprovalsPage';
import { RcIconCheckedCC, RcIconUncheckCC } from '../icons';
import { useTranslation } from 'react-i18next';
import { getSelectableContainerStyle, getTooltipContentStyles } from './Layout';
import BigNumber from 'bignumber.js';
import { ellipsisAddress } from '@/utils/address';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import TouchableView from '@/components/Touchable/TouchableView';
import { querySelectedAssetSpender } from '../utils';
import Permit2Badge from './Permit2Badge';

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

  // const balanceText = React.useMemo(() => {
  //   if (typeof balanceValue !== 'number') return balanceValue;

  //   return bizNumberUtils.formatNumber(balanceValue);
  // }, [balanceValue]);

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

      {/* {balanceText && (
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
      )} */}
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
      fontWeight: '500',
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

export function InModalApprovalAssetRow({
  style,
  approval,
  spender,
  onToggleSelection,
}: {
  approval: AssetApprovalItem;
  spender: AssetApprovalItem['list'][number];
  onToggleSelection?: (
    ctx: ToggleSelectApprovalSpenderCtx & { approval: AssetApprovalItem },
  ) => void;
} & RNViewProps) {
  const { colors, styles } = useThemeStyles(getStyles);

  const { assetFocusingRevokeMap } = useRevokeApprovals();
  const isSelected = React.useMemo(
    () => !!querySelectedAssetSpender(assetFocusingRevokeMap, spender),
    [spender, assetFocusingRevokeMap],
  );

  const { spenderInfo, spenderValues } = React.useMemo(() => {
    const risky = ['danger', 'warning'].includes(spender.risk_level);

    const value = new BigNumber(spender.value || 0);
    const isUnlimited = value.gte(10 ** 9);
    const displayApprovalValue = isUnlimited
      ? 'Unlimited'
      : bizNumberUtils.splitNumberByStep(value.toFixed(2));

    const spenderValues = spender
      ? approvalUtils.getSpenderApprovalAmount(spender)
      : null;

    const isNFT = spender.$assetContract?.contractFor !== 'token';
    // const isNFTCollection = isNFT && asset && 'nftContract' in asset;

    return {
      spenderInfo: {
        isNFT,
        tokenLogoURL: spender.$assetContract?.logo_url || '',
        nftImageURL: spender.$assetContract?.logo_url,
        protocolName: spender.protocol?.name || 'Unknown Contract',
        isRisky: risky,
        value,
        isUnlimited,
        displayApprovalValue,
      },
      spenderValues,
    };
  }, [spender]);

  return (
    <TouchableView
      style={[styles.container, isSelected && styles.selectedContainer, style]}
      onPress={() => {
        onToggleSelection?.({ spender, approval });
      }}>
      <View style={styles.leftArea}>
        <View style={styles.basicInfo}>
          <View style={styles.basicInfoF1}>
            <Text style={styles.address} ellipsizeMode="tail" numberOfLines={1}>
              {ellipsisAddress(spender.id)}
            </Text>
            <Text
              style={styles.protocolName}
              ellipsizeMode="tail"
              numberOfLines={1}>
              ({spenderInfo.protocolName})
            </Text>
          </View>
          {spender.$assetContract?.type === 'contract' &&
            !!spender.permit2_id && (
              <View style={styles.basicInfoF2}>
                <Permit2Badge style={styles.permit2} />
              </View>
            )}
        </View>
      </View>

      <View style={styles.rightArea}>
        {!spenderInfo.isNFT && (
          <ApprovalAmountInfo
            style={{ flexShrink: 1 }}
            {...(spenderValues
              ? {
                  amountValue: spenderValues.displayAmountText,
                  balanceValue: spenderValues.displayBalanceText,
                }
              : {
                  amountValue:
                    'amount' in spender ? (spender.amount as string) : '',
                  balanceValue: '',
                })}
          />
        )}
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

const getStyles = createGetStyles(colors => {
  const selectableStyles = getSelectableContainerStyle(colors);

  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 8,
      padding: 16,
      backgroundColor: colors['neutral-card1'],
      height: 60,
      ...selectableStyles.container,
    },
    selectedContainer: {
      ...selectableStyles.selectedContainer,
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
      fontSize: 14,
      lineHeight: 17,
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
    addressText: {
      color: colors['neutral-foot'],
      fontSize: 14,
      fontWeight: '400',
      // marginLeft: 6,
    },
    address: {
      fontWeight: '500',
      color: colors['neutral-title1'],
    },
    protocolName: {
      color: colors['neutral-foot'],
      marginLeft: 4,
    },
    itemCheckbox: {
      marginLeft: 16,
      width: 24,
      height: 24,
    },
    chainIcon: { marginRight: 12 },
    permit2: {
      marginLeft: 0,
    },
  };
});
