import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect } from '@react-navigation/native';
import type { ContactBookStore } from '@rabby-wallet/service-address';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { toast } from '@/components2024/Toast';
import { contactService } from '@/core/services';
import { perfEvents } from '@/core/utils/perf';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

type ContactAddressRow = {
  storeKey: string;
  address: string;
  remark: string;
  isDefaultAlias: boolean;
  legacyContactName?: string;
  hasAliasRecord: boolean;
  hasLegacyContact: boolean;
};

type ContactServiceSnapshot = {
  aliases: ContactBookStore['aliases'];
  contacts: ContactBookStore['contacts'];
  rows: ContactAddressRow[];
  refreshedAt: number;
};

function normalizeKey(address: string) {
  return address.toLowerCase();
}

function makeContactServiceSnapshot(): ContactServiceSnapshot {
  const aliases = contactService.getAliasByMap();
  const contacts = contactService.getContactsByMap();
  const allKeys = new Set([...Object.keys(aliases), ...Object.keys(contacts)]);

  const rows = [...allKeys]
    .map(key => {
      const normalizedKey = normalizeKey(key);
      const aliasItem = aliases[key] || aliases[normalizedKey];
      const legacyContact = contacts[key] || contacts[normalizedKey];
      const address = aliasItem?.address || legacyContact?.address || key;

      return {
        storeKey: key,
        address,
        remark: aliasItem?.alias || legacyContact?.name || '',
        isDefaultAlias: !!aliasItem?.isDefaultAlias,
        legacyContactName: legacyContact?.name,
        hasAliasRecord: !!aliasItem,
        hasLegacyContact: !!legacyContact,
      };
    })
    .sort(
      (left, right) =>
        left.address.localeCompare(right.address) ||
        left.remark.localeCompare(right.remark),
    );

  return {
    aliases,
    contacts,
    rows,
    refreshedAt: Date.now(),
  };
}

function EmptyState() {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No contact service data</Text>
      <Text style={styles.emptyDesc}>
        The contact service has no persisted address remark records yet.
      </Text>
    </View>
  );
}

function SummaryCard({ snapshot }: { snapshot: ContactServiceSnapshot }) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const aliasCount = Object.keys(snapshot.aliases).length;
  const contactCount = Object.keys(snapshot.contacts).length;
  const legacyOnlyCount = snapshot.rows.filter(
    item => !item.hasAliasRecord && item.hasLegacyContact,
  ).length;
  const customRemarkCount = snapshot.rows.filter(
    item => item.remark && !item.isDefaultAlias,
  ).length;

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.sectionTitle}>Contact Service Summary</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>
            Rows: {snapshot.rows.length}
          </Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>Aliases: {aliasCount}</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>Contacts: {contactCount}</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>
            Custom: {customRemarkCount}
          </Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>
            Legacy only: {legacyOnlyCount}
          </Text>
        </View>
      </View>
      <Text style={styles.refreshedAt}>
        Refreshed at {dayjs(snapshot.refreshedAt).format('HH:mm:ss')}
      </Text>
    </View>
  );
}

function ContactAddressCard({
  item,
  index,
}: {
  item: ContactAddressRow;
  index: number;
}) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <View style={styles.addressCard}>
      <View style={styles.addressCardHeader}>
        <Text style={styles.addressIndex}>#{index + 1}</Text>
        <View style={styles.addressBadges}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>
              {item.hasAliasRecord ? 'alias' : 'no alias'}
            </Text>
          </View>
          {item.hasLegacyContact ? (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>legacy contact</Text>
            </View>
          ) : null}
          {item.isDefaultAlias ? (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>default</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.remarkLabel}>Remark</Text>
      <Text style={styles.remarkValue} selectable>
        {item.remark || '-'}
      </Text>

      <Text style={styles.fieldLabel}>Address</Text>
      <Text style={styles.addressValue} selectable>
        {item.address}
      </Text>

      {item.storeKey !== normalizeKey(item.address) ? (
        <>
          <Text style={styles.fieldLabel}>Store key</Text>
          <Text style={styles.footValue} selectable>
            {item.storeKey}
          </Text>
        </>
      ) : null}

      {item.legacyContactName && item.legacyContactName !== item.remark ? (
        <>
          <Text style={styles.fieldLabel}>Legacy contact name</Text>
          <Text style={styles.footValue} selectable>
            {item.legacyContactName}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function DevDataContactService(): JSX.Element {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const [snapshot, setSnapshot] = useState<ContactServiceSnapshot>(() =>
    makeContactServiceSnapshot(),
  );

  const refreshSnapshot = useCallback(() => {
    setSnapshot(makeContactServiceSnapshot());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshSnapshot();
    }, [refreshSnapshot]),
  );

  useEffect(() => {
    const sub = perfEvents.subscribe('CONTACTS_ALIASES_UPDATE', () => {
      refreshSnapshot();
    });

    return () => {
      sub.remove();
    };
  }, [refreshSnapshot]);

  const rawJson = useMemo(
    () =>
      JSON.stringify(
        {
          aliases: snapshot.aliases,
          contacts: snapshot.contacts,
          rows: snapshot.rows,
        },
        null,
        2,
      ),
    [snapshot],
  );

  const copyJson = useCallback(() => {
    Clipboard.setString(rawJson);
    toast.success('Copied');
  }, [rawJson]);

  return (
    <FooterButtonScreenContainer
      as="View"
      style={styles.screen}
      buttonProps={{
        title: 'Refresh',
        onPress: refreshSnapshot,
      }}
      footerContainerStyle={styles.footerContainer}>
      <ScrollView
        horizontal={false}
        contentContainerStyle={styles.scrollView}
        nestedScrollEnabled>
        <SummaryCard snapshot={snapshot} />

        <Button
          title="Copy JSON"
          type="ghost"
          height={40}
          containerStyle={styles.copyButton}
          onPress={copyJson}
        />

        <Text style={styles.sectionTitle}>Address Remark Mapping</Text>
        {snapshot.rows.length ? (
          <View style={styles.listContainer}>
            {snapshot.rows.map((item, index) => (
              <ContactAddressCard
                key={`${item.storeKey}-${item.address}`}
                item={item}
                index={index}
              />
            ))}
          </View>
        ) : (
          <EmptyState />
        )}

        <View style={styles.jsonCard}>
          <Text style={styles.jsonTitle}>Raw JSON</Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            bounces={false}
            style={styles.jsonScrollArea}>
            <Text style={styles.jsonBody} selectable>
              {rawJson}
            </Text>
          </ScrollView>
        </View>
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
    paddingTop: 12,
    paddingBottom: 24,
  },
  summaryCard: {
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
  refreshedAt: {
    marginTop: 10,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  copyButton: {
    marginTop: 12,
    marginBottom: 16,
  },
  listContainer: {
    marginTop: 12,
    gap: 10,
  },
  addressCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-card-1'],
  },
  addressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  addressIndex: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  addressBadges: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
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
  remarkLabel: {
    marginTop: 12,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  remarkValue: {
    marginTop: 4,
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  fieldLabel: {
    marginTop: 10,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  addressValue: {
    marginTop: 4,
    color: colors2024['neutral-body'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  footValue: {
    marginTop: 4,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  jsonCard: {
    marginTop: 16,
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
    maxHeight: 260,
  },
  jsonBody: {
    color: colors2024['neutral-body'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    fontFamily: 'Courier',
  },
  emptyCard: {
    marginTop: 12,
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

export default DevDataContactService;
