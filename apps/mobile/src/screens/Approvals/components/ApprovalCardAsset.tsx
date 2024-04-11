import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import {
  AssetApprovalSpender,
  type AssetApprovalItem,
} from '../useApprovalsPage';

import { RcIconUnknown } from '../icons';
import { ApprovalsLayouts } from '../layout';
import { Chain } from '@debank/common';
import { AssetAvatar } from '@/components';
import { stringUtils } from '@rabby-wallet/base-utils';
import BigNumber from 'bignumber.js';
import { approvalUtils, bizNumberUtils } from '@rabby-wallet/biz-utils';

function ApprovalCardAssetsProto({
  assetItem: asset,
  inDetailModal = true,
}: {
  assetItem: AssetApprovalItem;
  inDetailModal?: boolean;
} & RNViewProps) {
  const { colors, styles } = useThemeStyles(getAssetItemStyles);
  const { t } = useTranslation();

  const { assetName, nftTypeBadge, displayBalanceText } = React.useMemo(() => {
    const assetInfo = {
      assetName: '',
      nftType: null as null | 'collection' | 'nft',
      nftTypeBadge: '',
      balanceText: '',
    };
    let balance = 0 as number;

    if (asset?.type === 'nft') {
      assetInfo.nftType = asset.nftContract ? 'collection' : 'nft';
      assetInfo.nftTypeBadge =
        assetInfo.nftType === 'collection' ? 'Collection' : 'NFT';

      if (asset?.nftToken) {
        assetInfo.assetName = stringUtils.ensureSuffix(
          asset?.name || 'Unknown',
          ` #${asset?.nftToken.inner_id}`,
        );
        assetInfo.balanceText = asset?.nftToken.amount;
      } else if (asset?.nftContract) {
        assetInfo.assetName = asset?.nftContract.contract_name || 'Unknown';
        assetInfo.balanceText = asset?.nftContract.amount;
      }
    } else {
      assetInfo.assetName = asset?.name || 'Unknown';
      balance = bizNumberUtils.coerceFloat(asset.balance);
      assetInfo.balanceText = bizNumberUtils.formatAmount(balance);
    }

    return {
      assetName: assetInfo.assetName,
      nftTypeBadge: assetInfo.nftTypeBadge,
      displayBalanceText: assetInfo.balanceText,
    };
  }, [asset]);

  return (
    <View style={[styles.container]}>
      <View style={styles.floor}>
        <View style={styles.lineLabel}>
          {asset?.logo_url ? (
            <AssetAvatar
              logo={asset?.logo_url}
              logoStyle={{ backgroundColor: colors['neutral-foot'] }}
              chain={asset?.chain}
              chainIconPosition="tr"
              style={{ marginRight: 12 }}
              size={28}
              chainSize={16}
            />
          ) : (
            <RcIconUnknown width={28} height={28} style={styles.chainIcon} />
          )}
          <View style={styles.basicInfo}>
            <Text
              style={styles.assetNameText}
              ellipsizeMode="tail"
              numberOfLines={1}>
              {assetName}
            </Text>
            {nftTypeBadge && (
              <Text
                style={styles.nftTypeBadge}
                ellipsizeMode="tail"
                numberOfLines={1}>
                {nftTypeBadge}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.lineValue}>
          <Text style={styles.lineValueText}>
            {asset.list.length} Approval{asset.list.length > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {displayBalanceText && (
        <View style={[styles.floor, { marginTop: 12 }]}>
          <View style={styles.lineLabel}>
            <Text style={styles.lineLabelText}>My Balance</Text>
          </View>
          <View style={styles.lineValue}>
            <Text style={styles.lineValueText}>{displayBalanceText}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export const getAssetItemStyles = createGetStyles(colors => {
  return {
    container: {
      borderRadius: 8,
      backgroundColor: colors['neutral-card1'],
      flexDirection: 'column',
      justifyContent: 'center',
      paddingVertical: 10,
      width: '100%',
      padding: ApprovalsLayouts.assetsItemPadding,
    },
    floor: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    basicInfo: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    lineLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      // ...makeDebugBorder('red'),
    },
    lineLabelText: {
      color: colors['neutral-body'],
      fontSize: 13,
      fontWeight: '400',
    },
    lineValue: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    lineValueText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors['neutral-title1'],
    },
    nftTypeBadge: {
      borderRadius: 2,
      borderStyle: 'solid',
      borderColor: colors['neutral-line'],
      borderWidth: 0.5,
      marginTop: 6,
      paddingVertical: 1,
      paddingHorizontal: 4,
      fontSize: 12,
      fontWeight: '400',
      color: colors['neutral-foot'],
    },
    chainIcon: {
      marginRight: 6,
    },
    assetNameText: {
      color: colors['neutral-title1'],
      fontSize: 16,
      fontWeight: '600',
      maxWidth: 180,
    },
  };
});

const ApprovalCardAsset = React.memo(ApprovalCardAssetsProto);

export default ApprovalCardAsset;
