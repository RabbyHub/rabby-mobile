import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TouchableOpacity, View } from 'react-native';

import RcCaretDownSmallCC from '@/assets2024/icons/common/caret-down-small-cc.svg';
import RcConvertCC from '@/assets2024/icons/convertDust/convert-cc.svg';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { AssetAvatar } from '@/components/AssetAvatar';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { CHAINS_ENUM } from '@/constant/chains';
import type { Account } from '@/core/services/preference';
import { useFindChain } from '@/hooks/useFindChain';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { getTokenIcon } from '@/utils/tokenIcon';
import { createGetStyles2024 } from '@/utils/styles';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { ChainInfo2024 } from '../Send/components/ChainInfo2024';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import useTokenList, {
  EMPTY_TOKEN_LIST,
  getTokenSelectCacheKey,
  ITokenItem,
  useTokenListComputedStore,
} from '@/store/tokens';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { BottomSheetView } from '@gorhom/bottom-sheet';

const DUST_FILTERS = ['<$0.1', '<$1', '<$10', '<$100', '<$1000'] as const;
const PRICE_IMPACT_OPTIONS = ['1%', '3%', '10%', '20%'] as const;
const GAS_LIMIT_OPTIONS = ['$0.01', '$0.05', '$0.1', '$1'] as const;
const DUST_FILTER_VALUE_MAP: Record<(typeof DUST_FILTERS)[number], number> = {
  '<$0.1': 0.1,
  '<$1': 1,
  '<$10': 10,
  '<$100': 100,
  '<$1000': 1000,
};

const ETH_CHAIN = CHAINS_ENUM.ETH;

const getTokenKey = (token: ITokenItem) =>
  `${token.owner_addr}:${token.chain}:${token.id}`;

function useConvertDustTokenList({
  address,
  chainServerId,
  selectedFilter,
}: {
  address?: string;
  chainServerId?: string;
  selectedFilter: (typeof DUST_FILTERS)[number];
}) {
  const lowerAddress = address?.toLowerCase();
  const addresses = useMemo(() => (address ? [address] : []), [address]);
  const getTokenList = useTokenList(state => state.getTokenList);
  const isLoading = useTokenList(state => {
    if (!lowerAddress) {
      return false;
    }
    return !!state.isLoadingByAddress[lowerAddress]?.loading;
  });
  const registerTokenSelect = useTokenListComputedStore(
    state => state.registerTokenSelect,
  );
  const tokenSelectKey = useMemo(
    () => getTokenSelectCacheKey(addresses, chainServerId),
    [addresses, chainServerId],
  );

  useEffect(() => {
    if (!address) {
      return;
    }
    getTokenList(address);
  }, [address, getTokenList]);

  useEffect(() => {
    registerTokenSelect(addresses, chainServerId);
  }, [addresses, chainServerId, registerTokenSelect]);

  const tokens = useTokenListComputedStore(
    state => state.tokenSelectCache[tokenSelectKey] || EMPTY_TOKEN_LIST,
  );
  const threshold = DUST_FILTER_VALUE_MAP[selectedFilter];

  const dustTokens = useMemo(
    () =>
      tokens.filter(token => {
        const usdValue = token.usd_value || token.price * token.amount || 0;
        return usdValue > 0 && usdValue < threshold;
      }),
    [threshold, tokens],
  );

  return {
    tokens: dustTokens,
    isLoading,
  };
}

export function ConvertDustScreen(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const { safeOffBottom } = useSafeSizes();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const [chainEnum, setChainEnum] = useState(ETH_CHAIN);
  const chain = useFindChain({ enum: chainEnum });
  const [selectedFilter, setSelectedFilter] =
    useState<(typeof DUST_FILTERS)[number]>('<$10');
  const [priceImpact, setPriceImpact] =
    useState<(typeof PRICE_IMPACT_OPTIONS)[number]>('3%');
  const [singleTxGasLimit, setSingleTxGasLimit] =
    useState<(typeof GAS_LIMIT_OPTIONS)[number]>('$0.1');
  const [activeSettingSheet, setActiveSettingSheet] = useState<
    'priceImpact' | 'gasLimit' | null
  >(null);
  const [selectedTokens, setSelectedTokens] = useState<Record<string, boolean>>(
    {},
  );
  const { tokens: dustTokens, isLoading: isTokenListLoading } =
    useConvertDustTokenList({
      address: currentAccount?.address,
      chainServerId: chain?.serverId,
      selectedFilter,
    });

  const hasSelectedToken = useMemo(
    () => Object.values(selectedTokens).some(Boolean),
    [selectedTokens],
  );
  const getAccountDisabledTips = useCallback((account: Account) => {
    if (
      account.type === KEYRING_CLASS.PRIVATE_KEY ||
      account.type === KEYRING_CLASS.MNEMONIC
    ) {
      return undefined;
    }

    return '该类地址不支持此功能';
  }, []);

  useEffect(() => {
    setSelectedTokens({});
  }, [chain?.serverId, currentAccount?.address, selectedFilter]);

  const toggleToken = (token: ITokenItem) => {
    const key = getTokenKey(token);
    setSelectedTokens(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleAll = () => {
    if (hasSelectedToken) {
      setSelectedTokens({});
      return;
    }

    setSelectedTokens(
      dustTokens.reduce<Record<string, boolean>>((acc, token) => {
        acc[getTokenKey(token)] = true;
        return acc;
      }, {}),
    );
  };

  const renderTokenItem = useCallback(
    ({ item }: { item: ITokenItem }) => {
      const key = getTokenKey(item);
      return (
        <DustTokenRow
          token={item}
          selected={!!selectedTokens[key]}
          onPress={() => toggleToken(item)}
        />
      );
    },
    [selectedTokens],
  );

  return (
    <NormalScreenContainer2024
      type="bg2"
      overwriteStyle={styles.screen}
      noHeader={false}>
      <View style={[styles.content, { paddingBottom: safeOffBottom + 100 }]}>
        <ChainInfo2024
          chainEnum={chainEnum}
          onChange={setChainEnum}
          hideTestnetTab
          account={currentAccount!}
          style={styles.chainSelector}
        />

        <View style={styles.convertCard}>
          <View style={styles.filterRow}>
            {DUST_FILTERS.map(filter => {
              const selected = selectedFilter === filter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => setSelectedFilter(filter)}
                  style={[
                    styles.filterChip,
                    selected && styles.filterChipActive,
                  ]}>
                  <Text
                    style={[
                      styles.filterText,
                      selected && styles.filterTextActive,
                    ]}>
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.listHeader}>
            <Pressable style={styles.tokenHeaderLeft} onPress={toggleAll}>
              <CheckBoxRect checked={hasSelectedToken} size={18} />
              <Text style={styles.headerText}>Token</Text>
            </Pressable>
            <Text style={styles.headerText}>Value/Amount</Text>
          </View>

          <View style={styles.tokenListWrap}>
            {isTokenListLoading ? (
              <Text style={styles.emptyText}>Loading tokens...</Text>
            ) : dustTokens.length ? (
              <FlatList
                style={styles.tokenListScroll}
                data={dustTokens}
                keyExtractor={getTokenKey}
                renderItem={renderTokenItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.tokenListScrollContent}
              />
            ) : (
              <Text style={styles.emptyText}>No dust tokens</Text>
            )}
          </View>
          {dustTokens.length > 6 ? (
            <View style={styles.scrollbarThumb} />
          ) : null}
        </View>

        <View style={styles.receiveCard}>
          <View style={styles.receiveTokenWrap}>
            <AssetAvatar
              logo={chain?.logo || getTokenIcon('ETH')}
              size={46}
              chain={chain?.serverId}
              chainSize={18}
              innerChainStyle={styles.receiveChainBadge}
            />
            <Text style={styles.receiveSymbol}>
              {chain?.nativeTokenSymbol || 'ETH'}
            </Text>
          </View>
          <View style={styles.receiveValueWrap}>
            <Text style={styles.receiveHint}>
              Est.Receive: 0 {chain?.nativeTokenSymbol || 'ETH'}
            </Text>
            <Text style={styles.receiveValue}>$0</Text>
          </View>
        </View>

        <View style={styles.settingsBlock}>
          <SettingRow
            label="Price Impact"
            value={priceImpact}
            onPress={() => setActiveSettingSheet('priceImpact')}
          />
          <SettingRow
            label="Single Transaction Gas Limit"
            value={singleTxGasLimit}
            onPress={() => setActiveSettingSheet('gasLimit')}
          />
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.bottomBar, { paddingBottom: safeOffBottom + 17 }]}>
        <Button
          title="Start convert"
          height={52}
          disabled={!hasSelectedToken}
          icon={<RcConvertCC width={22} height={22} />}
          containerStyle={styles.ctaContainer}
          buttonStyle={styles.ctaButton}
          titleStyle={styles.ctaTitle}
          noShadow
        />
      </View>
      <AccountSwitcherModal
        forScene="MakeTransactionAbout"
        getAccountDisabledTips={getAccountDisabledTips}
      />
      <ConvertDustPresetSheet
        visible={activeSettingSheet === 'priceImpact'}
        title="Price Impact"
        value={priceImpact}
        options={PRICE_IMPACT_OPTIONS}
        onCancel={() => setActiveSettingSheet(null)}
        onConfirm={nextValue => {
          setPriceImpact(nextValue as typeof priceImpact);
          setActiveSettingSheet(null);
        }}
      />
      <ConvertDustPresetSheet
        visible={activeSettingSheet === 'gasLimit'}
        title="Single Transaction Gas Limit"
        value={singleTxGasLimit}
        options={GAS_LIMIT_OPTIONS}
        onCancel={() => setActiveSettingSheet(null)}
        onConfirm={nextValue => {
          setSingleTxGasLimit(nextValue as typeof singleTxGasLimit);
          setActiveSettingSheet(null);
        }}
      />
    </NormalScreenContainer2024>
  );
}

function DustTokenRow({
  token,
  selected,
  onPress,
}: {
  token: ITokenItem;
  selected: boolean;
  onPress: () => void;
}) {
  const { styles } = useTheme2024({ getStyle });

  return (
    <Pressable onPress={onPress} style={styles.tokenRow}>
      <CheckBoxRect checked={selected} size={18} />
      <AssetAvatar
        logo={token.logo_url || getTokenIcon(token.symbol)}
        size={24}
        chain={token.chain}
        chainSize={10}
        innerChainStyle={styles.tokenChainBadge}
      />
      <View style={styles.tokenNameColumn}>
        <Text style={styles.tokenSymbol}>
          {token.display_symbol || token.optimized_symbol || token.symbol}
        </Text>
      </View>
      <View style={styles.tokenValueColumn}>
        <Text style={styles.tokenValue}>{formatUsdValue(token.usd_value)}</Text>
        <Text style={styles.tokenAmount}>
          {formatTokenAmount(token.amount)} {token.symbol}
        </Text>
      </View>
    </Pressable>
  );
}

function SettingRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingValueWrap}>
        <Text style={styles.settingValue}>{value}</Text>
        <RcCaretDownSmallCC
          width={14}
          height={14}
          color={colors2024['neutral-title-1']}
        />
      </View>
    </TouchableOpacity>
  );
}

function ConvertDustPresetSheet({
  visible,
  title,
  value,
  options,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  value: string;
  options: readonly string[];
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const { styles } = useTheme2024({ getStyle });
  const { safeOffBottom } = useSafeSizes();
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    if (visible) {
      setDraftValue(value);
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [value, visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={[258 + safeOffBottom]}
      onDismiss={onCancel}
      backgroundStyle={styles.sheetBackground}
      handleStyle={styles.sheetHandle}
      handleIndicatorStyle={styles.sheetHandleIndicator}>
      <BottomSheetView
        style={[styles.presetSheet, { paddingBottom: safeOffBottom + 21 }]}>
        <Text style={styles.presetSheetTitle}>{title}</Text>
        <View style={styles.presetOptions}>
          {options.map(option => {
            const selected = draftValue === option;
            return (
              <Pressable
                key={option}
                onPress={() => setDraftValue(option)}
                style={[
                  styles.presetOption,
                  selected && styles.presetOptionActive,
                ]}>
                <Text
                  style={[
                    styles.presetOptionText,
                    selected && styles.presetOptionTextActive,
                  ]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.presetActions}>
          <Pressable
            style={[styles.presetActionButton, styles.presetCancelButton]}
            onPress={onCancel}>
            <Text style={[styles.presetActionText, styles.presetCancelText]}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            style={[styles.presetActionButton, styles.presetConfirmButton]}
            onPress={() => onConfirm(draftValue)}>
            <Text style={[styles.presetActionText, styles.presetConfirmText]}>
              Confirm
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  chainSelector: {
    height: 58,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chainLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chainIcon: {
    borderRadius: 6,
  },
  chainTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  chainCaretWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors2024['neutral-line'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  convertCard: {
    flex: 1,
    minHeight: 180,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 12,
    overflow: 'hidden',
    maxHeight: 396,
  },
  filterRow: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterChip: {
    width: 66,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors2024['neutral-line'],
  },
  filterText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  filterTextActive: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  listHeader: {
    height: 34,
    paddingLeft: 4,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  tokenListWrap: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  tokenListScroll: {
    flex: 1,
  },
  tokenListScrollContent: {
    gap: 4,
    paddingBottom: 4,
  },
  emptyText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 72,
    textAlign: 'center',
  },
  tokenRow: {
    height: 40,
    paddingLeft: 4,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenChainBadge: {
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-1'],
  },
  tokenNameColumn: {
    width: 106,
    justifyContent: 'center',
  },
  tokenSymbol: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  tokenValueColumn: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  tokenValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  tokenAmount: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  scrollbarThumb: {
    position: 'absolute',
    right: 5,
    top: 58,
    width: 5,
    height: 78,
    borderRadius: 100,
    backgroundColor: colors2024['neutral-line'],
  },
  receiveCard: {
    height: 80,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiveTokenWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiveChainBadge: {
    borderWidth: 1.5,
    borderColor: colors2024['neutral-bg-1'],
  },
  receiveSymbol: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  receiveValueWrap: {
    alignItems: 'flex-end',
  },
  receiveHint: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  receiveValue: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
  },
  settingsBlock: {
    marginTop: 14,
    paddingHorizontal: 4,
    gap: 14,
  },
  settingRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  settingValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  sheetBackground: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  sheetHandle: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  sheetHandleIndicator: {
    width: 50,
    height: 6,
    borderRadius: 100,
    backgroundColor: colors2024['neutral-line'],
  },
  presetSheet: {
    paddingTop: 8,
    paddingHorizontal: 19.5,
  },
  presetSheetTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  presetOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 25,
  },
  presetOption: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
  },
  presetOptionActive: {
    backgroundColor: colors2024['brand-light-1'],
  },
  presetOptionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  presetOptionTextActive: {
    color: colors2024['brand-default'],
  },
  presetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 25,
  },
  presetActionButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetCancelButton: {
    backgroundColor: colors2024['neutral-bg-2'],
  },
  presetConfirmButton: {
    backgroundColor: colors2024['brand-default'],
  },
  presetActionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  presetCancelText: {
    color: colors2024['neutral-title-1'],
  },
  presetConfirmText: {
    color: colors2024['neutral-InvertHighlight'],
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingTop: 12,
    paddingHorizontal: 24,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  ctaContainer: {
    height: 52,
  },
  ctaButton: {
    height: 52,
    borderRadius: 12,
  },
  ctaTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
}));

export default ConvertDustScreen;
