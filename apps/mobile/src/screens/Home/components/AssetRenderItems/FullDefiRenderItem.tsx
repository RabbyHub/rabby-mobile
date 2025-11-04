import React, { useCallback, useMemo } from 'react';
import { View, Text, ViewStyle, StyleProp } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { WrapperDappActionsMemoItem } from '../../components/ProtocolMoreItem';
import { AbstractPortfolio, AbstractProject } from '../../types';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import BigNumber from 'bignumber.js';
import { formatNetworth } from '@/utils/math';
import { ellipsisAddress } from '@/utils/address';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { isAppChain } from '../../utils/appchain';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { matomoRequestEvent } from '@/utils/analytics';
import { AssetAvatar } from '@/components/AssetAvatar';
import { ellipsisOverflowedText } from '@/utils/text';

type SectionListItem = {
  data: AbstractPortfolio[];
  project: AbstractProject;
  address: string;
  type: KEYRING_TYPE;
  aliasName: string;
  totalUsdValue: BigNumber;
};
interface Props {
  data: AbstractProject;
  account: KeyringAccountWithAlias;
  showAccount?: boolean;
  style?: StyleProp<ViewStyle>;
}
export const FullDefiRenderItem = ({
  data,
  account,
  showAccount,
  style,
}: Props) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const isFromAppChain = useMemo(() => {
    return isAppChain(data?.chain || '');
  }, [data?.chain]);

  const { t } = useTranslation();

  const { openTab } = useBrowser();

  const handleOpenSite = useCallback(() => {
    if (data?.site_url) {
      openTab(data?.site_url);
      const origin = safeGetOrigin(data?.site_url);
      if (origin) {
        matomoRequestEvent({
          category: 'Websites Usage',
          action: 'Website_Visit_Defi Detail',
          label: origin,
        });
      }
    }
  }, [data?.site_url, openTab]);

  const sectionsMultiProject = useMemo(() => {
    const sectionsList: SectionListItem[] = [
      {
        data: data?._portfolios || [],
        project: data,
        totalUsdValue: new BigNumber(data?.netWorth || 0),
        type: account.type,
        address: account.address,
        aliasName: account.aliasName || ellipsisAddress(account.address),
      },
    ];
    return sectionsList;
  }, [data, account.type, account.address, account.aliasName]);

  // 来自同一个地址的totalUsdValue不重复计算
  const sumNetWorth = useMemo(() => {
    const addressMap = new Map<string, SectionListItem>();
    sectionsMultiProject.forEach(item => {
      if (!addressMap.has(item.address.toLowerCase())) {
        addressMap.set(item.address.toLowerCase(), item);
      }
    });
    const res = Array.from(addressMap.values()).reduce((pre, cur) => {
      return pre.plus(cur.totalUsdValue);
    }, new BigNumber(0));
    return res ? formatNetworth(res.toNumber()) : data?._netWorth || 0;
  }, [data?._netWorth, sectionsMultiProject]);

  if (!data) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerArea}>
        <View style={styles.headerLeft}>
          <AssetAvatar
            logo={data?.logo}
            logoStyle={styles.assetIcon}
            size={40}
            chain={
              isFromAppChain
                ? ''
                : data?.chain || sectionsMultiProject[0]?.project?.chain
            }
            chainSize={16}
          />
          <View style={styles.tokenInfo}>
            <Text
              style={styles.tokenSymbol}
              numberOfLines={1}
              ellipsizeMode="tail">
              {/* {token?.name} */}
              {ellipsisOverflowedText(
                data?.name || sectionsMultiProject[0]?.project?.name,
                20,
              )}
            </Text>
            {showAccount && (
              <View style={styles.accountBox}>
                <View className="relative">
                  <WalletIcon
                    type={account.type as KEYRING_TYPE}
                    address={account.address}
                    width={styles.walletIcon.width}
                    height={styles.walletIcon.height}
                    style={styles.walletIcon}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.titleText}>
                  {account.aliasName}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.projectHeaderNetWorth}>{sumNetWorth}</Text>
      </View>

      <View style={styles.portfoliosContainer}>
        {data?._portfolios?.map?.(item => (
          <WrapperDappActionsMemoItem
            item={item}
            chain={data?.chain}
            protocolLogo={data?.logo}
            address={account.address}
            addressType={account.type}
            key={`${item.id}-${account.address}-${data.netWorth}`}
            session={
              data?.site_url && data?.logo
                ? {
                    name: data?.name,
                    icon: data?.logo || '',
                    origin: data?.site_url || '',
                  }
                : undefined
            }
          />
        ))}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  scrollContainer: {
    flex: 1,
    width: '100%',
    marginTop: 8,
    // backgroundColor: colors2024['neutral-bg-4'],
  },
  accountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonStyle: {
    // width: 56,
    // height: 56,
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: -16,
    paddingLeft: 16,
  },
  titleText: {
    flexShrink: 1,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    flexWrap: 'nowrap',
  },
  walletIcon: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  projectHeaderBalance: {
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'left',
    marginLeft: 25,
    marginBottom: 7,
  },
  projectHeaderNetWorth: {
    color: colors2024['neutral-title-1'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'left',
  },
  headerArea: {
    width: '100%',
    height: 'auto',
    // marginLeft: 4,
    paddingLeft: 4,
    paddingRight: 12,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assetIcon: {
    borderRadius: 40,
  },
  tokenInfo: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  },
  tokenSymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    flexWrap: 'nowrap',
  },
  container: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: colors2024['neutral-bg-1'],
    marginHorizontal: 16,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  portfoliosContainer: {
    width: '100%',
  },
  footer: {
    width: '100%',
    paddingBottom: 56,
    paddingHorizontal: 16,
  },
  appChainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    backgroundColor: colors2024['neutral-bg-5'],
    marginHorizontal: 16,
    borderRadius: 6,
    marginBottom: 20,
  },
  appChainHeaderText: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
}));
