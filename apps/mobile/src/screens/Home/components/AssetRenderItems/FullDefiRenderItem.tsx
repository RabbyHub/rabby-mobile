import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ViewStyle, StyleProp, Pressable } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { WrapperDappActionsMemoItem } from '../../components/ProtocolMoreItem';
import { AbstractPortfolio, AbstractProject } from '../../types';
import { KeyringAccountWithAlias } from '@/hooks/account';
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
import { AccountOverview } from '../AccountOverview';
import { useProtocolConfig } from '../../utils/protocolConfig';
import JumpIconCC from '@/assets2024/icons/home/jump-cc.svg';
import { usePortfolios } from '../../hooks/usePortfolio';
import { useLoadAssets } from '@/screens/Search/useAssets';
import { setRefreshHistoryId } from '../../SingleHomeRightArea';
import { dappService } from '@/core/services';
import { CHAINS_ENUM } from '@debank/common';
import { findChain } from '@/utils/chain';
import RcExpandCC from '@/assets/icons/home/defi-expand.svg';
import {
  isBlacklistMethod,
  isWhitelistAddress,
  isWhitelistSpender,
} from '../DappActions/hook';
import { ActionType } from '../DappActions';

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
  account?: KeyringAccountWithAlias | null;
  showAccount?: boolean;
  style?: StyleProp<ViewStyle>;
  disableAction?: boolean;
  defaultExpand?: boolean;
}
export const FullDefiRenderItem = ({
  data,
  account,
  showAccount,
  style,
  disableAction,
  defaultExpand,
}: Props) => {
  const [isExpand, setIsExpand] = useState(defaultExpand ?? false);
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const isFromAppChain = useMemo(() => {
    return isAppChain(data?.chain || '');
  }, [data?.chain]);

  const { updateSpecificProtocol } = usePortfolios(account?.address, false);
  const { loadSpecificDefi } = useLoadAssets();
  const { openTab } = useBrowser();

  const handleOpenSite = useCallback(() => {
    if (data?.site_url) {
      openTab(data?.site_url);
      const origin = safeGetOrigin(data?.site_url);
      const chain = findChain({ serverId: data.chain });
      dappService.patchDapps({
        [origin]: {
          currentAccount: account,
          chainId: isFromAppChain ? undefined : chain?.enum || CHAINS_ENUM.ETH,
          isDapp: true,
        },
      });
      if (origin) {
        matomoRequestEvent({
          category: 'Websites Usage',
          action: 'Website_Visit_Defi Detail',
          label: origin,
        });
      }
    }
  }, [account, data.chain, data?.site_url, isFromAppChain, openTab]);

  const sectionsMultiProject = useMemo(() => {
    if (!account) {
      return [];
    }
    const sectionsList: SectionListItem[] = [
      {
        data: data?._portfolios || [],
        project: data,
        totalUsdValue: new BigNumber(data?.netWorth || 0),
        type: account?.type,
        address: account?.address,
        aliasName: account?.aliasName || ellipsisAddress(account?.address),
      },
    ];
    return sectionsList;
  }, [account, data]);

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

  const { config } = useProtocolConfig();
  const isInnerProtocol = useMemo(() => !!config[data.id], [data.id, config]);
  const ProtocolIcon = useMemo(
    () => config[data.id]?.icon || null,
    [data.id, config],
  );
  const handleRefresh = useCallback(async () => {
    setTimeout(() => {
      if (!account) {
        return;
      }
      if (showAccount) {
        loadSpecificDefi(account.address, data?.id, data?.chain || '');
      } else {
        setRefreshHistoryId(e => e + 1);
        updateSpecificProtocol(data?.id, data?.chain || '');
      }
    }, 200);
  }, [
    account,
    showAccount,
    loadSpecificDefi,
    data?.id,
    data?.chain,
    updateSpecificProtocol,
  ]);

  const protocolActionList = useMemo(() => {
    // 协议中是否存在可以 Manage 的仓位
    const result: Set<string> = new Set();
    if (config?.[data.id]?.showManage) {
      const canShowManage = data._portfolios.some(item =>
        config[data.id]?.showManage?.(item, account),
      );
      const hasHandleManageFunc = !!config[data.id]?.onManage;
      if (canShowManage && hasHandleManageFunc) {
        result.add('Manage'); // 这里暂时不做 i18n，tag 的空间小，避免其他语种单词过长挤压其他空间
      }
    }

    for (let i = 0; i < data._portfolios.length; i++) {
      if (result.size >= 3 || !data.chain) {
        break; // 最多只有 3 个标签，发现标签足够就不需要再继续遍历下去了
      }
      const item = data._portfolios[i];
      const actions = item?._originPortfolio?.withdraw_actions || [];
      for (let k = 0; k < actions.length; k++) {
        const action = actions[k];
        if (
          action?.need_approve?.to &&
          !isWhitelistSpender(action.need_approve?.to, data.chain)
        ) {
          continue; // 需要 approve 但不在白名单内，直接跳过
        }
        if (action?.func && isBlacklistMethod(action?.func)) {
          continue;
        }
        if (action?.type && ['withdraw', 'queue'].includes(action?.type)) {
          result.add('Withdraw');
        }
        if (action?.type === 'claim') {
          result.add('Claim');
        }
      }
    }
    return Array.from(result.values());
  }, [account, config, data]);

  useEffect(() => {
    setIsExpand(defaultExpand ?? false);
  }, [defaultExpand]);

  const handleToggleExpand = useCallback(() => {
    setIsExpand(pre => !pre);
  }, []);

  const portfolios = useMemo(() => {
    return data._portfolios || [];
  }, [data]);

  if (!data || !account) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <Pressable onPress={handleToggleExpand}>
        <View style={styles.headerArea}>
          <View style={styles.headerLeft}>
            <AssetAvatar
              logo={data?.logo}
              logoStyle={styles.assetIcon}
              size={46}
              innerChainStyle={styles.chainLogo}
              chain={
                isFromAppChain
                  ? ''
                  : data?.chain || sectionsMultiProject[0]?.project?.chain
              }
              chainSize={18}
            />
            <View style={styles.tokenInfo}>
              <View style={styles.tokenInfoHeader}>
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
                <Pressable hitSlop={20} onPress={handleOpenSite}>
                  <JumpIconCC
                    width={14}
                    height={14}
                    color={colors2024['neutral-secondary']}
                  />
                </Pressable>
              </View>
              {showAccount && account && <AccountOverview account={account} />}
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.headerRightLeft}>
              <Text style={styles.projectHeaderNetWorth}>{sumNetWorth}</Text>
              {!isExpand && (
                <View style={styles.protocolActionsList}>
                  {protocolActionList.length > 0 &&
                    protocolActionList.map(item => (
                      <View
                        style={styles.protocolActionsItemWrapper}
                        key={item}>
                        <Text style={styles.protocolActionsItem} key={item}>
                          {item}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
            </View>
            <View style={styles.expandIcon}>
              <RcExpandCC
                color={colors2024['neutral-title-1']}
                style={{
                  transform: [{ rotate: `${isExpand ? 180 : 0}deg` }],
                }}
              />
            </View>
          </View>
          {isInnerProtocol && isExpand && (
            <View style={styles.innerProtocolContainer} pointerEvents="none">
              {ProtocolIcon && <ProtocolIcon width={125} height={70} />}
            </View>
          )}
        </View>
      </Pressable>

      {isExpand && (
        <View style={styles.portfoliosContainer}>
          {portfolios.map((item, index) => (
            <WrapperDappActionsMemoItem
              item={item}
              chain={data?.chain}
              protocolLogo={data?.logo}
              onRefresh={handleRefresh}
              address={account.address}
              addressType={account.type}
              disableAction={disableAction}
              isLast={index === portfolios.length - 1}
              manageAction={
                config?.[data.id]?.showManage &&
                config[data.id]?.showManage?.(item, account)
                  ? config[data.id]?.onManage
                  : undefined
              }
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
      )}
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
  backButtonStyle: {
    // width: 56,
    // height: 56,
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: -16,
    paddingLeft: 16,
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
    textAlign: 'right',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expandIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerArea: {
    width: '100%',
    height: 'auto',
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assetIcon: {
    borderRadius: 40,
  },
  chainLogo: {
    borderWidth: 1.5,
    borderColor: colors2024['neutral-bg-1'],
  },
  tokenInfo: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  },
  tokenInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tokenSymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
  container: {
    position: 'relative',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-3'],
    marginHorizontal: 16,
    borderRadius: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  portfoliosContainer: {
    width: '100%',
    marginTop: 12,
    borderTopColor: colors2024['neutral-line'],
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
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
  innerProtocolContainer: {
    position: 'absolute',
    top: -12,
    right: 0,
  },
  gradientBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 16,
    right: 0,
    height: 82,
  },
  protocolActionsList: {
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
  },
  protocolActionsItemWrapper: {
    borderRadius: 4,
    paddingHorizontal: 4,
    backgroundColor: colors2024['brand-light-1'],
  },
  protocolActionsItem: {
    color: colors2024['brand-default'],
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 16,
  },
  headerRightLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
}));
