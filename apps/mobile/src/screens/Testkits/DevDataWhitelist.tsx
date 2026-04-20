import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { AddressAliasItem } from '@rabby-wallet/service-address';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

import { RcIconLockCC } from '@/assets/icons/send';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { PillsSwitch } from '@/components2024/PillSwitch';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { toast } from '@/components2024/Toast';
import RNHelpers from '@/core/native/RNHelpers';
import { contactService, whitelistService } from '@/core/services';
import { appStorage } from '@/core/storage/mmkv';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { AccountInfoEntity } from '@/databases/entities/accountInfo';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { useWhitelist } from '@/hooks/whitelist';
import { makeAccountObject, findAccountByPriority } from '@/utils/account';
import { createGetStyles2024 } from '@/utils/styles';
import { sortWhitelistRecords } from '@/utils/whitelist';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';

const FALLBACK_LEGACY_WHITELIST = [
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
];

const TAB_OPTIONS = [
  { key: 'whitelist', label: '白名单列表' },
  { key: 'addressBook', label: '地址簿' },
  { key: 'debug', label: '调试信息' },
] as const;

type TabKey = (typeof TAB_OPTIONS)[number]['key'];

type WhitelistDebugItem = {
  address: string;
  alias: string;
  addedAt: number | null;
  addedAtLabel: string;
  matchedAccounts: string[];
  displayAccount: KeyringAccountWithAlias;
};

type AddressBookDebugItem = {
  address: string;
  alias: string;
  inWhitelist: boolean;
  matchedAccounts: string[];
  displayAccount: KeyringAccountWithAlias;
};

function EmptyState({ title, desc }: { title: string; desc: string }) {
  const { styles } = useTheme2024({ getStyle: getStyles, isLight: true });

  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
    </View>
  );
}

function AddressDebugCard({
  account,
  title,
  metaItems,
  showWhitelistLock = false,
}: {
  account: KeyringAccountWithAlias;
  title: string;
  metaItems?: string[];
  showWhitelistLock?: boolean;
}) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <AddressItemShadowView style={styles.listCard}>
      <AddressItem account={account}>
        {({ WalletIcon }) => (
          <View style={styles.listCardInner}>
            <View style={styles.listCardMain}>
              <View style={styles.listIconWrapper}>
                <WalletIcon
                  style={styles.listWalletIcon}
                  width={46}
                  height={46}
                />
                {showWhitelistLock ? (
                  <RcIconLockCC
                    style={styles.listLockIcon}
                    color={colors2024['brand-default']}
                    surroundColor={colors2024['neutral-bg-1']}
                    width={22}
                    height={22}
                  />
                ) : null}
              </View>
              <View style={styles.listInfo}>
                <Text style={styles.listTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.listAddress} numberOfLines={1}>
                  {account.address}
                </Text>
              </View>
            </View>
            {metaItems?.length ? (
              <View style={styles.listMetaRow}>
                {metaItems.map(item => (
                  <View
                    key={`${account.address}-${item}`}
                    style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText} numberOfLines={1}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </AddressItem>
    </AddressItemShadowView>
  );
}

function ScrollablePanel({
  maxHeight,
  children,
}: {
  maxHeight: number;
  children: React.ReactNode;
}) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <View style={[styles.scrollPanel, { maxHeight }]}>
      <ScrollView
        nestedScrollEnabled
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollPanelContent}>
        {children}
      </ScrollView>
    </View>
  );
}

function DevDataWhitelist(): JSX.Element {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const { height: windowHeight } = useWindowDimensions();
  const [tabKey, setTabKey] = useState<TabKey>('whitelist');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [resolvedAddedAtByAddress, setResolvedAddedAtByAddress] = useState<
    Record<string, number>
  >({});
  const { accounts, fetchAccounts } = useAccounts();
  const { whitelist, whitelistEnabled, fetchWhitelist } = useWhitelist();
  const panelMaxHeight = useMemo(
    () => Math.floor(windowHeight * 0.5),
    [windowHeight],
  );

  useEffect(() => {
    let isCurrent = true;

    const loadAddedAt = async () => {
      if (!whitelist.length) {
        setResolvedAddedAtByAddress({});
        return;
      }

      try {
        const nextMap = await AccountInfoEntity.getCreatedAtByAddresses(
          whitelist,
        );
        if (isCurrent) {
          setResolvedAddedAtByAddress(nextMap);
        }
      } catch {
        if (isCurrent) {
          setResolvedAddedAtByAddress({});
        }
      }
    };

    loadAddedAt();

    return () => {
      isCurrent = false;
    };
  }, [refreshVersion, whitelist]);

  const refreshAll = useCallback(() => {
    fetchWhitelist();
    fetchAccounts();
    setRefreshVersion(value => value + 1);
  }, [fetchAccounts, fetchWhitelist]);

  const accountsByAddress = useMemo(() => {
    return accounts.reduce<Record<string, KeyringAccountWithAlias[]>>(
      (result, account) => {
        const key = account.address.toLowerCase();
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(account);
        return result;
      },
      {},
    );
  }, [accounts]);

  const aliasMap = contactService.getAliasByMap();
  const aliasItems = Object.values(aliasMap).filter(
    (item): item is AddressAliasItem => !!item?.address && !!item?.alias,
  );

  const getDisplayAccount = useCallback(
    (address: string, alias?: string) => {
      const matchedAccounts = accountsByAddress[address.toLowerCase()] || [];
      if (matchedAccounts.length) {
        const account = findAccountByPriority([...matchedAccounts]);
        return alias && account.aliasName !== alias
          ? {
              ...account,
              aliasName: alias,
            }
          : account;
      }

      const fallbackAccount = makeAccountObject<KeyringAccountWithAlias>({
        address,
        brandName: KEYRING_CLASS.WATCH,
      });

      return alias
        ? {
            ...fallbackAccount,
            aliasName: alias,
          }
        : fallbackAccount;
    },
    [accountsByAddress],
  );

  const whitelistItems = useMemo<WhitelistDebugItem[]>(() => {
    return sortWhitelistRecords(
      whitelistService.getWhitelistRecords(),
      resolvedAddedAtByAddress,
    ).map(record => {
      const address = record.address;
      const alias = contactService.getAliasByAddress(address)?.alias || '-';
      const matchedAccounts = (
        accountsByAddress[address.toLowerCase()] || []
      ).map(account => account.brandName || account.type);
      const addedAt =
        record.addedAt ?? resolvedAddedAtByAddress[address] ?? null;

      return {
        address,
        alias,
        addedAt,
        addedAtLabel: addedAt
          ? dayjs(addedAt).format('YYYY/MM/DD HH:mm:ss')
          : '-',
        matchedAccounts,
        displayAccount: getDisplayAccount(address, alias),
      };
    });
  }, [accountsByAddress, getDisplayAccount, resolvedAddedAtByAddress]);

  const addressBookItems = useMemo<AddressBookDebugItem[]>(() => {
    return [...aliasItems]
      .sort(
        (left, right) =>
          left.alias.localeCompare(right.alias) ||
          left.address.localeCompare(right.address),
      )
      .map(item => {
        const address = item.address.toLowerCase();
        const matchedAccounts = (accountsByAddress[address] || []).map(
          account => account.brandName || account.type,
        );

        return {
          address,
          alias: item.alias,
          inWhitelist: whitelist.some(wa => isSameAddress(wa, address)),
          matchedAccounts,
          displayAccount: getDisplayAccount(address, item.alias),
        };
      });
  }, [accountsByAddress, aliasItems, getDisplayAccount, whitelist]);

  const whitelistSummary = {
    total: whitelistItems.length,
    matchedAccountCount: whitelistItems.filter(
      item => item.matchedAccounts.length,
    ).length,
    resolvedTimeCount: whitelistItems.filter(item => !!item.addedAt).length,
  };

  const addressBookSummary = {
    total: addressBookItems.length,
    whitelistCount: addressBookItems.filter(item => item.inWhitelist).length,
    localCount: addressBookItems.filter(item => item.matchedAccounts.length)
      .length,
  };

  const whitelistDebugPayload = JSON.stringify(
    {
      enabled: whitelistEnabled,
      addresses: whitelistItems.map(item => item.address),
      storeRecords: whitelistService.getWhitelistRecords(),
      resolvedAddedAtByAddress,
      items: whitelistItems.map(item => ({
        address: item.address,
        alias: item.alias,
        addedAt: item.addedAt,
        addedAtLabel: item.addedAtLabel,
        matchedAccounts: item.matchedAccounts,
      })),
    },
    null,
    2,
  );

  const addressBookDebugPayload = JSON.stringify(
    {
      aliasItems: aliasItems.map(item => ({
        address: item.address.toLowerCase(),
        alias: item.alias,
        isDefaultAlias: !!item.isDefaultAlias,
      })),
      items: addressBookItems.map(item => ({
        address: item.address,
        alias: item.alias,
        inWhitelist: item.inWhitelist,
        matchedAccounts: item.matchedAccounts,
      })),
    },
    null,
    2,
  );

  const mockLegacyWhitelistData = () => {
    const legacyAddresses = (
      whitelistItems.length
        ? whitelistItems.map(item => item.address)
        : FALLBACK_LEGACY_WHITELIST
    ).slice(0, 5);

    appStorage.setItem(APP_STORE_NAMES.whitelist, {
      enabled: whitelistEnabled,
      whitelists: legacyAddresses,
    });

    const serviceMigrations =
      (appStorage.getItem(APP_MMKV_WEAK_KEYS.SERVICE_MIGRATIONS) as Record<
        string,
        string
      > | null) || {};
    delete serviceMigrations[APP_STORE_NAMES.whitelist];
    appStorage.setItem(
      APP_MMKV_WEAK_KEYS.SERVICE_MIGRATIONS,
      serviceMigrations,
    );
    appStorage.flushToDisk?.();

    Alert.alert(
      'Mock done',
      [
        'Legacy whitelist data has been written to persistent storage.',
        `Addresses: ${legacyAddresses.length}`,
        'Restart the app to trigger the whitelist migration.',
      ].join('\n'),
      [
        { text: 'OK' },
        {
          text: 'Exit App',
          style: 'destructive',
          onPress: () => {
            RNHelpers.forceExitApp();
          },
        },
      ],
    );
  };

  const renderWhitelistTab = () => {
    if (!whitelistItems.length) {
      return (
        <EmptyState
          title="Whitelist is empty"
          desc="Sync from the extension, or add whitelist addresses locally first."
        />
      );
    }

    return (
      <>
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Whitelist Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Enabled: {whitelistEnabled ? 'true' : 'false'}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Total: {whitelistSummary.total}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Local: {whitelistSummary.matchedAccountCount}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Time: {whitelistSummary.resolvedTimeCount}
              </Text>
            </View>
          </View>
        </View>

        <ScrollablePanel maxHeight={panelMaxHeight}>
          {whitelistItems.map((item, index) => {
            const metaItems = [
              `#${index + 1}`,
              `Added: ${item.addedAtLabel}`,
              item.matchedAccounts.length
                ? `Local: ${item.matchedAccounts.join(', ')}`
                : 'Local: -',
            ];

            return (
              <AddressDebugCard
                key={`whitelist-${item.address}`}
                account={item.displayAccount}
                title={item.alias}
                metaItems={metaItems}
                showWhitelistLock
              />
            );
          })}
        </ScrollablePanel>
      </>
    );
  };

  const renderAddressBookTab = () => {
    if (!addressBookItems.length) {
      return (
        <EmptyState
          title="Address book is empty"
          desc="No alias mapping is persisted in the local contact book yet."
        />
      );
    }

    return (
      <>
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Address Book Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Total: {addressBookSummary.total}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                In WL: {addressBookSummary.whitelistCount}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Local: {addressBookSummary.localCount}
              </Text>
            </View>
          </View>
        </View>

        <ScrollablePanel maxHeight={panelMaxHeight}>
          {addressBookItems.map(item => {
            const metaItems = [
              item.inWhitelist ? 'In whitelist' : 'Not in whitelist',
              item.matchedAccounts.length
                ? `Local: ${item.matchedAccounts.join(', ')}`
                : 'Local: -',
            ];

            return (
              <AddressDebugCard
                key={`alias-${item.address}`}
                account={item.displayAccount}
                title={item.alias}
                metaItems={metaItems}
                showWhitelistLock={item.inWhitelist}
              />
            );
          })}
        </ScrollablePanel>
      </>
    );
  };

  const renderDebugTab = () => {
    return (
      <>
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Enabled: {whitelistEnabled ? 'true' : 'false'}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Total: {whitelistSummary.total}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Local: {whitelistSummary.matchedAccountCount}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Time: {whitelistSummary.resolvedTimeCount}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Alias: {addressBookSummary.total}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Button
            title="Copy JSON"
            type="ghost"
            height={40}
            containerStyle={styles.singleActionButton}
            onPress={() => {
              Clipboard.setString(
                [
                  '[whitelist]',
                  whitelistDebugPayload,
                  '[addressBook]',
                  addressBookDebugPayload,
                ].join('\n\n'),
              );
              toast.success('Copied');
            }}
          />
        </View>

        <Button
          title="Mock Old Data"
          type="warning"
          height={40}
          containerStyle={styles.mockActionButton}
          onPress={mockLegacyWhitelistData}
        />

        <Text style={styles.helperText}>
          Writes legacy `string[]` whitelist data to raw storage and clears the
          whitelist migration marker. Restart the app to verify migration.
        </Text>

        <View style={[styles.jsonCard, { maxHeight: panelMaxHeight }]}>
          <Text style={styles.jsonTitle}>Whitelist JSON</Text>
          <ScrollView
            nestedScrollEnabled
            bounces={false}
            style={styles.jsonScrollArea}
            contentContainerStyle={styles.jsonScrollContent}>
            <Text style={styles.jsonBody} selectable>
              {whitelistDebugPayload}
            </Text>
          </ScrollView>
        </View>

        <View style={[styles.jsonCard, { maxHeight: panelMaxHeight }]}>
          <Text style={styles.jsonTitle}>Address Book JSON</Text>
          <ScrollView
            nestedScrollEnabled
            bounces={false}
            style={styles.jsonScrollArea}
            contentContainerStyle={styles.jsonScrollContent}>
            <Text style={styles.jsonBody} selectable>
              {addressBookDebugPayload}
            </Text>
          </ScrollView>
        </View>
      </>
    );
  };

  return (
    <FooterButtonScreenContainer
      as="View"
      style={styles.screen}
      buttonProps={{
        title: 'Refresh',
        onPress: refreshAll,
      }}
      footerContainerStyle={styles.footerContainer}>
      <ScrollView
        horizontal={false}
        contentContainerStyle={styles.scrollView}
        nestedScrollEnabled>
        <PillsSwitch
          value={tabKey}
          options={TAB_OPTIONS}
          onTabChange={key => {
            setTabKey(key);
          }}
          containerStyle={styles.tabSwitch}
          itemStyle={styles.tabSwitchItem}
        />

        {tabKey === 'whitelist'
          ? renderWhitelistTab()
          : tabKey === 'addressBook'
          ? renderAddressBookTab()
          : renderDebugTab()}
      </ScrollView>
    </FooterButtonScreenContainer>
  );
}

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  footerContainer: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors2024['neutral-line'],
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  tabSwitch: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  tabSwitchItem: {
    flex: 1,
    minWidth: 0,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  summaryCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-card-1'],
  },
  sectionTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  summaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  summaryBadgeText: {
    color: colors2024['neutral-body'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    marginTop: 0,
  },
  singleActionButton: {
    marginTop: 0,
  },
  mockActionButton: {
    marginTop: 8,
  },
  helperText: {
    marginTop: 8,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  scrollPanel: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-1'],
    overflow: 'hidden',
  },
  scrollPanelContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  listCard: {
    marginTop: 10,
    backgroundColor: colors2024['neutral-card-1'],
  },
  listCardInner: {
    padding: 14,
  },
  listCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listIconWrapper: {
    position: 'relative',
  },
  listWalletIcon: {
    width: 46,
    height: 46,
  },
  listLockIcon: {
    position: 'absolute',
    right: -4,
    bottom: -2,
  },
  listInfo: {
    flex: 1,
    minWidth: 0,
  },
  listTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  listAddress: {
    marginTop: 4,
    color: colors2024['neutral-foot'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  listMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  metaBadge: {
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  metaBadgeText: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  jsonCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-card-1'],
  },
  jsonTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  jsonScrollArea: {
    marginTop: 8,
  },
  jsonScrollContent: {
    paddingBottom: 2,
  },
  jsonBody: {
    color: colors2024['neutral-body'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    fontFamily: 'Courier',
  },
  emptyCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-card-1'],
  },
  emptyTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  emptyDesc: {
    marginTop: 8,
    color: colors2024['neutral-foot'],
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
}));

export default DevDataWhitelist;
