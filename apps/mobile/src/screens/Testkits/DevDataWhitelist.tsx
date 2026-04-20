import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { toast } from '@/components2024/Toast';
import { contactService, whitelistService } from '@/core/services';
import { AccountInfoEntity } from '@/databases/entities/accountInfo';
import { useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { useWhitelist } from '@/hooks/whitelist';
import { createGetStyles2024 } from '@/utils/styles';
import { sortWhitelistRecords } from '@/utils/whitelist';

function DevDataWhitelist(): JSX.Element {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [resolvedAddedAtByAddress, setResolvedAddedAtByAddress] = useState<
    Record<string, number>
  >({});
  const { accounts, fetchAccounts } = useAccounts();
  const { whitelist, whitelistEnabled, fetchWhitelist } = useWhitelist();

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

  const whitelistItems = sortWhitelistRecords(
    whitelistService.getWhitelistRecords(),
    resolvedAddedAtByAddress,
  ).map(record => {
    const address = record.address;
    const alias = contactService.getAliasByAddress(address)?.alias || '-';
    const matchedAccounts = accounts
      .filter(account => isSameAddress(account.address, address))
      .map(account => account.brandName || account.type);
    const addedAt = record.addedAt ?? resolvedAddedAtByAddress[address] ?? null;

    return {
      address,
      alias,
      addedAt,
      addedAtLabel: addedAt ? dayjs(addedAt).format('YYYY/MM/DD HH:mm') : '-',
      matchedAccounts,
    };
  });

  const matchedAccountCount = whitelistItems.filter(
    item => item.matchedAccounts.length > 0,
  ).length;
  const resolvedTimeCount = whitelistItems.filter(
    item => !!item.addedAt,
  ).length;
  const summary = {
    total: whitelistItems.length,
    matchedAccountCount,
    resolvedTimeCount,
  };

  const debugPayload = JSON.stringify(
    {
      enabled: whitelistEnabled,
      addresses: whitelistItems.map(item => item.address),
      items: whitelistItems,
    },
    null,
    2,
  );

  return (
    <NormalScreenContainer noHeader style={styles.screen}>
      <ScrollView
        horizontal={false}
        contentContainerStyle={styles.scrollView}
        nestedScrollEnabled>
        <Text style={styles.areaTitle}>Whitelist Data</Text>

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
                Total: {summary.total}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Local: {summary.matchedAccountCount}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Time: {summary.resolvedTimeCount}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Button
            title="Refresh"
            type="primary"
            height={40}
            containerStyle={styles.actionButton}
            onPress={() => {
              fetchWhitelist();
              fetchAccounts();
              setRefreshVersion(value => value + 1);
            }}
          />
          <Button
            title="Copy JSON"
            type="ghost"
            height={40}
            containerStyle={styles.actionButton}
            onPress={() => {
              Clipboard.setString(debugPayload);
              toast.success('Copied');
            }}
          />
        </View>

        {whitelistItems.length ? (
          whitelistItems.map((item, index) => {
            return (
              <View key={item.address} style={styles.itemCard}>
                <View style={styles.itemHeaderRow}>
                  <Text style={styles.itemIndex}>#{index + 1}</Text>
                  <Text style={styles.itemAlias} numberOfLines={1}>
                    {item.alias}
                  </Text>
                  <Text style={styles.itemTime}>{item.addedAtLabel}</Text>
                </View>
                <Text style={styles.itemAddress}>{item.address}</Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  Local:{' '}
                  {item.matchedAccounts.length
                    ? item.matchedAccounts.join(', ')
                    : '-'}
                </Text>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Whitelist is empty</Text>
            <Text style={styles.emptyDesc}>
              Sync from the extension, or add whitelist addresses locally first.
            </Text>
          </View>
        )}
      </ScrollView>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  scrollView: {
    padding: 20,
    paddingBottom: 48,
  },
  areaTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
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
  itemCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-card-1'],
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemIndex: {
    color: colors2024['neutral-foot'],
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  itemAlias: {
    flex: 1,
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  itemTime: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  itemAddress: {
    marginTop: 8,
    color: colors2024['neutral-body'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  itemMeta: {
    marginTop: 6,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
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
