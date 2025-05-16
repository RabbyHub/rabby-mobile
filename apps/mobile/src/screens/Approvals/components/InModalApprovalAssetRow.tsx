import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { approvalUtils, bizNumberUtils } from '@rabby-wallet/biz-utils';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';

import { RcIconNoCheck, RcIconHasCheckbox } from '@/assets/icons/common';
import { AssetAvatar, Tip } from '@/components';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024, useThemeStyles } from '@/hooks/theme';
import {
  AssetApprovalItem,
  ToggleSelectApprovalSpenderCtx,
} from '../useApprovalsPage';
import { getTooltipContentStyles } from './Layout';
import Permit2Badge from './Permit2Badge';

function ApprovalAmountInfo({
  style,
  amountValue,
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
    if (typeof amountValue !== 'number') {
      return amountValue;
    }

    return bizNumberUtils.formatNumber(amountValue);
  }, [amountValue]);

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
        fontFamily: 'SF Pro Rounded',
        color: colors2024['neutral-foot'],
      },
      approvalValues: {
        marginTop: 4,
        fontSize: 13,
        fontWeight: '400',
        color: colors['neutral-foot'],
      },
    };
  },
);

export function InModalApprovalAssetRow({
  style,
  approval,
  spender,
  onToggleSelection,
  isSelected,
}: {
  approval: AssetApprovalItem;
  spender: AssetApprovalItem['list'][number];
  onToggleSelection?: (
    ctx: ToggleSelectApprovalSpenderCtx & { approval: AssetApprovalItem },
  ) => void;
  isSelected: boolean;
} & RNViewProps) {
  const { t } = useTranslation();
  const { colors, styles } = useTheme2024({ getStyle: getStyle });

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
        protocolName:
          spender.protocol?.name || t('page.approvals.unknownContract'),
        isRisky: risky,
        value,
        isUnlimited,
        displayApprovalValue,
      },
      spenderValues,
    };
  }, [spender, t]);

  return (
    <TouchableOpacity
      style={[styles.container, isSelected && styles.selectedContainer, style]}
      onPress={() => {
        onToggleSelection?.({ spender, approval });
      }}>
      <View style={styles.leftArea}>
        <View style={styles.itemCheckbox}>
          {isSelected ? (
            <RcIconHasCheckbox color={colors['blue-default']} />
          ) : (
            <RcIconNoCheck color={colors['neutral-line']} />
          )}
        </View>

        <AssetAvatar
          style={styles.chainIcon}
          // pass empty if it's token as no logo_url to enforce the default logo
          logo={spender.protocol?.logo_url || ''}
          logoStyle={{ backgroundColor: colors['neutral-foot'] }}
          chain={spender.protocol?.chain || approval.chain}
          chainIconPosition="br"
          size={46}
          chainSize={16}
        />

        <View style={styles.basicInfo}>
          <View style={styles.basicInfoF1}>
            <Text
              style={styles.protocolName}
              ellipsizeMode="tail"
              numberOfLines={1}>
              {spenderInfo.protocolName}
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
      </View>
    </TouchableOpacity>
  );
}

const getStyle = createGetStyles2024(ctx => {
  const { colors, colors2024, isLight } = ctx;

  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 72,
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
      fontSize: 14,
      lineHeight: 17,
    },
    basicInfoF2: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
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
      fontWeight: '700',
      fontSize: 14,
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
    },
    protocolName: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
    },
    itemCheckbox: {
      marginRight: 12,
      width: 24,
      height: 24,
    },
    permit2: {
      marginLeft: 0,
    },
    chainIcon: {
      marginRight: 12,
    },
  };
});
