import React from 'react';
import { View, Text } from 'react-native';

import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { type AssetApprovalItem } from '../useApprovalsPage';

import { RcIconUnknown } from '../icons';
import { AssetAvatar } from '@/components';
import { stringUtils } from '@rabby-wallet/base-utils';
import { bizNumberUtils } from '@rabby-wallet/biz-utils';
import { getSelectableContainerStyle } from './Layout';
import { useTranslation } from 'react-i18next';

function ApprovalCardAssetsProto({
  assetItem: asset,
  style,
}: {
  assetItem: AssetApprovalItem;
  inDetailModal?: boolean;
} & RNViewProps) {
  const { t } = useTranslation();
  const { colors2024, styles } = useTheme2024({ getStyle: getAssetItemStyles });

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
    <View style={[styles.container, style]}>
      <View style={styles.floor}>
        <View style={[styles.lineLabel, styles.header]}>
          <AssetAvatar
            logo={asset?.logo_url}
            logoStyle={{ backgroundColor: colors2024['neutral-foot'] }}
            chain={asset?.chain}
            chainIconPosition="br"
            style={{ marginRight: 7 }}
            size={36}
            chainSize={16}
          />

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

      <View style={[styles.divider]} />

      <View style={styles.main}>
        <View style={[styles.floor]}>
          <View style={styles.lineLabel}>
            <Text style={styles.lineLabelText}>
              {t('page.approvals.allApprovals')}
            </Text>
          </View>
          <View style={styles.lineValue}>
            <Text style={styles.lineValueText}>{asset.list.length}</Text>
          </View>
        </View>

        {displayBalanceText && (
          <View style={[styles.floor, { marginTop: 12 }]}>
            <View style={styles.lineLabel}>
              <Text style={styles.lineLabelText}>
                {t('page.approvals.myBalance')}
              </Text>
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

export const getAssetItemStyles = createGetStyles2024(ctx => {
  const selectableStyles = getSelectableContainerStyle(ctx);
  const { colors2024, isLight } = ctx;

  return {
    container: {
      borderRadius: 20,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      flexDirection: 'column',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      width: '100%',
      ...selectableStyles.container,
    },
    floor: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    main: {},
    divider: {
      height: 1,
      marginBottom: 16,
      marginTop: 16,
      backgroundColor: colors2024['neutral-line'],
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
      fontWeight: '500',
      lineHeight: 18,
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
      lineHeight: 18,
    },
    nftTypeBadge: {
      borderRadius: 2,
      borderStyle: 'solid',
      borderColor: colors2024['neutral-line'],
      borderWidth: 0.5,
      paddingVertical: 4,
      paddingHorizontal: 4,
      fontSize: 12,
      lineHeight: 12,
      marginTop: 2,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '400',
      color: colors2024['neutral-foot'],
    },
    chainIcon: {
      marginRight: 6,
    },
    assetNameText: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
    },
  };
});

const ApprovalCardAsset = React.memo(ApprovalCardAssetsProto);

export default ApprovalCardAsset;
