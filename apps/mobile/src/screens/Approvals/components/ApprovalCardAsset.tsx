import React from 'react';
import { View, Text } from 'react-native';

import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { type AssetApprovalItem } from '../useApprovalsPage';

import { RcIconUnknown } from '../icons';
import { AssetAvatar } from '@/components';
import { stringUtils } from '@rabby-wallet/base-utils';
import { bizNumberUtils } from '@rabby-wallet/biz-utils';

function ApprovalCardAssetsProto({
  assetItem: asset,
}: {
  assetItem: AssetApprovalItem;
  inDetailModal?: boolean;
} & RNViewProps) {
  const { colors, styles } = useTheme2024({ getStyle: getAssetItemStyles });

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
        <View style={[styles.lineLabel, styles.header]}>
          {asset?.logo_url ? (
            <AssetAvatar
              logo={asset?.logo_url}
              logoStyle={{ backgroundColor: colors['neutral-foot'] }}
              chain={asset?.chain}
              chainIconPosition="tr"
              style={{ marginRight: 7 }}
              size={36}
              chainSize={16}
            />
          ) : (
            <RcIconUnknown width={36} height={36} style={styles.chainIcon} />
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
      </View>

      <View style={styles.main}>
        <View style={[styles.floor, { marginTop: 0 }]}>
          <View style={styles.lineLabel}>
            <Text style={styles.lineLabelText}>All Approvals</Text>
          </View>
          <View style={styles.lineValue}>
            <Text style={styles.lineValueText}>{asset.list.length}</Text>
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
    </View>
  );
}

export const getAssetItemStyles = createGetStyles2024(
  ({ colors, colors2024 }) => {
    return {
      container: {
        borderRadius: 8,
        backgroundColor: colors['neutral-card1'],
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
      },
      floor: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      },
      main: {
        borderRadius: 30,
        borderWidth: 1,
        paddingVertical: 20,
        paddingHorizontal: 24,
        marginTop: 24,
        borderColor: colors2024['neutral-line'],
        backgroundColor: colors2024['neutral-bg-1'],
      },
      basicInfo: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
      },
      lineLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        // ...makeDebugBorder('red'),
      },
      header: {
        width: '100%',
      },
      lineLabelText: {
        fontFamily: 'SF Pro Rounded',
        color: colors2024['neutral-foot'],
        fontSize: 14,
        fontWeight: '700',
      },
      lineValue: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
      },
      lineValueText: {
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'SF Pro Rounded',
        color: colors2024['neutral-body'],
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
        fontFamily: 'SF Pro Rounded',
        fontWeight: '400',
        color: colors['neutral-foot'],
      },
      chainIcon: {
        marginRight: 6,
      },
      assetNameText: {
        color: colors2024['neutral-title-1'],
        fontFamily: 'SF Pro Rounded',
        fontSize: 20,
        fontWeight: '700',
        maxWidth: 180,
      },
    };
  },
);

const ApprovalCardAsset = React.memo(ApprovalCardAssetsProto);

export default ApprovalCardAsset;
