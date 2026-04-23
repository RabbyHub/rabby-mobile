import dayjs from 'dayjs';
import React from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import {
  ContextMenuView,
  type MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { toast } from '@/components2024/Toast';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import {
  useAccountRemovingVisualStage,
  useAccounts,
  storeApiAccounts,
  type KeyringAccountWithAlias,
} from '@/hooks/account';
import { useDeletingOpacity } from '@/hooks/useDeletingOpacity';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import {
  useResourceFlowTraceEntries,
  type ResourceFlowTraceEntry,
} from '@/store/_resourceFlowDebug';
import { accountResourceStore, useAccountStore } from '@/store/account';
import { shortEllipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import { showDeleteAccountModal } from '@/screens/Address/useDeleteAccountModal';
import { useAddressDetailModal } from '@/screens/Address/useAddressDetailModal';
import addressBalanceStore from '@/store/balance';
import { appChainResourceStore, useAppChainStore } from '@/store/appchain';
import { formatUsdValue } from '@/utils/number';

const PAGE_HORIZONTAL_PADDING = 20;
const GRAPH_CARD_INNER_PADDING = 18;
const GRAPH_MIN_HEIGHT = 144;
const GRAPH_NODE_GAP_Y = 42;
const GRAPH_SOURCE_X = 28;
const GRAPH_TOP_PADDING = 28;
const GRAPH_BOTTOM_PADDING = 34;
const MAX_VISIBLE_GRAPH_NODES = 24;
const NODE_RADIUS = 6;
const NEW_HIGHLIGHT_DURATION_MS = 2800;
const ACTION_SHEET_SNAP_POINTS = [620];
const FOOTER_CONTAINER_HEIGHT = 92;
const ITEM_SEPARATOR_STYLE = { height: 12 } as const;
const BALANCE_DELTA_EPSILON = 0.01;
const MENU_ICONS = {
  deleteDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_delete_dark.png'),
  delete: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_delete.png'),
  moreDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_more_dark.png'),
  more: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_more.png'),
  refreshDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_refresh_dark.png'),
  refresh: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_refresh.png'),
};

type DebugNodeStatus = 'idle' | 'loading' | 'ready' | 'error' | 'deleting';

type AccountPlaygroundNode = {
  key: string;
  account: KeyringAccountWithAlias;
  label: string;
  resourceKey: string;
  status: DebugNodeStatus;
  persistStatus: ReturnType<
    typeof accountResourceStore.useSnapshots
  >[number]['persistStatus'];
  flow: ReturnType<typeof accountResourceStore.useSnapshots>[number]['flow'];
  sourceOfCurrentValue?: ReturnType<
    typeof accountResourceStore.useSnapshots
  >[number]['sourceOfCurrentValue'];
  totalBalance: number;
  evmBalance: number;
  appChainBalance: number;
  appChainCount: number;
  balanceDelta: number;
  isHighlighted: boolean;
  isDeleting: boolean;
};

function makeAccountDebugKey(account: KeyringAccountWithAlias) {
  return (
    accountResourceStore.getResourceKey(account) ||
    [account.address.toLowerCase(), account.type, account.brandName || ''].join(
      '::',
    )
  );
}

function distribute(index: number, count: number, min: number, max: number) {
  if (count <= 1) {
    return (min + max) / 2;
  }

  return min + ((max - min) * index) / (count - 1);
}

function getGraphColumns(count: number) {
  if (count <= 4) {
    return Math.max(1, count);
  }

  if (count <= 12) {
    return 4;
  }

  return 5;
}

function getStatusLabel(status: DebugNodeStatus) {
  switch (status) {
    case 'deleting':
      return 'deleting';
    case 'ready':
      return 'ready';
    case 'loading':
      return 'loading';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

function getStatusTone(status: DebugNodeStatus) {
  switch (status) {
    case 'deleting':
      return 'danger' as const;
    case 'ready':
      return 'success' as const;
    case 'loading':
      return 'warning' as const;
    case 'error':
      return 'danger' as const;
    default:
      return status === 'idle' ? ('brand' as const) : ('muted' as const);
  }
}

function getNodeBadgeLabel(node: AccountPlaygroundNode) {
  switch (node.status) {
    case 'deleting':
      return 'x';
    case 'loading':
      return '...';
    case 'error':
      return '!';
    default:
      return '';
  }
}

function formatTraceLine(entry: ResourceFlowTraceEntry) {
  const detailLabels = [
    entry.detail?.source,
    entry.detail?.requester,
    entry.detail?.method,
  ].filter(Boolean);

  return [
    dayjs(entry.at).format('HH:mm:ss.SSS'),
    entry.type,
    detailLabels.length ? detailLabels.join(' / ') : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function hasMeaningfulBalanceDelta(delta: number) {
  return Math.abs(delta) >= BALANCE_DELTA_EPSILON;
}

function SummaryBadge({
  label,
  tone = 'muted',
}: {
  label: string;
  tone?: 'muted' | 'brand' | 'success' | 'warning' | 'danger';
}) {
  const { styles } = useTheme2024({ getStyle, isLight: true });

  return (
    <View
      style={[
        styles.summaryBadge,
        tone === 'brand'
          ? styles.summaryBadgeBrand
          : tone === 'success'
          ? styles.summaryBadgeSuccess
          : tone === 'warning'
          ? styles.summaryBadgeWarning
          : tone === 'danger'
          ? styles.summaryBadgeDanger
          : styles.summaryBadgeMuted,
      ]}>
      <Text style={styles.summaryBadgeText}>{label}</Text>
    </View>
  );
}

function FlowChip({
  label,
  tone,
  compact = false,
}: {
  label: string;
  tone: 'muted' | 'brand' | 'success' | 'warning' | 'danger';
  compact?: boolean;
}) {
  const { styles } = useTheme2024({ getStyle, isLight: true });

  return (
    <View
      style={[
        styles.flowChip,
        compact && styles.flowChipCompact,
        tone === 'brand'
          ? styles.flowChipBrand
          : tone === 'success'
          ? styles.flowChipSuccess
          : tone === 'warning'
          ? styles.flowChipWarning
          : tone === 'danger'
          ? styles.flowChipDanger
          : styles.flowChipMuted,
      ]}>
      <Text
        style={[styles.flowChipText, compact && styles.flowChipTextCompact]}>
        {label}
      </Text>
    </View>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  const { styles } = useTheme2024({ getStyle, isLight: true });

  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

function AccountGraph({
  nodes,
  selectedKey,
}: {
  nodes: AccountPlaygroundNode[];
  selectedKey: string | null;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle, isLight: true });
  const { width: windowWidth } = useWindowDimensions();

  const graphWidth = Math.max(
    240,
    windowWidth - PAGE_HORIZONTAL_PADDING * 2 - GRAPH_CARD_INNER_PADDING * 2,
  );
  const columns = getGraphColumns(nodes.length);
  const rows = Math.max(1, Math.ceil(nodes.length / columns));
  const graphHeight = Math.max(
    GRAPH_MIN_HEIGHT,
    GRAPH_TOP_PADDING +
      GRAPH_BOTTOM_PADDING +
      Math.max(0, rows - 1) * GRAPH_NODE_GAP_Y +
      NODE_RADIUS * 6,
  );
  const targetMinX = Math.min(138, graphWidth - 88);
  const targetMaxX = graphWidth - 24;
  const sourceY = graphHeight / 2;

  const statusColors = React.useMemo(
    () => ({
      deleting: 'rgba(255, 107, 107, 0.78)',
      error: colors2024['red-default'],
      idle: 'rgba(135, 145, 161, 0.72)',
      loading: colors2024['orange-default'],
      no_fetcher: 'rgba(135, 145, 161, 0.42)',
      ready: colors2024['green-default'],
      source: colors2024['brand-default'],
    }),
    [colors2024],
  );

  const graphNodes = React.useMemo(() => {
    return nodes.slice(0, MAX_VISIBLE_GRAPH_NODES).map((node, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = distribute(column, columns, targetMinX, targetMaxX);
      const y = distribute(
        row,
        rows,
        GRAPH_TOP_PADDING,
        graphHeight - GRAPH_BOTTOM_PADDING,
      );
      const edgeEndX = x - 12;
      const controlX = GRAPH_SOURCE_X + (x - GRAPH_SOURCE_X) * 0.48;
      const path = [
        `M ${GRAPH_SOURCE_X} ${sourceY}`,
        `C ${controlX} ${sourceY}, ${controlX} ${y}, ${edgeEndX} ${y}`,
      ].join(' ');

      return {
        ...node,
        x,
        y,
        path,
        badgeLabel: getNodeBadgeLabel(node) || `#${index + 1}`,
      };
    });
  }, [columns, graphHeight, nodes, rows, sourceY, targetMaxX, targetMinX]);

  return (
    <View style={styles.graphCard}>
      <SectionHeader
        title="Account Graph"
        hint={`Graph shows up to ${MAX_VISIBLE_GRAPH_NODES} accounts`}
      />

      <View style={styles.legendRow}>
        <FlowChip compact label="ready" tone="success" />
        <FlowChip compact label="loading" tone="warning" />
        <FlowChip compact label="deleting" tone="danger" />
        <FlowChip compact label="error" tone="danger" />
        <FlowChip compact label="idle" tone="brand" />
      </View>

      <View style={styles.graphCanvasWrap}>
        <Svg height={graphHeight} style={styles.graphCanvas} width={graphWidth}>
          <SvgText
            fill={colors2024['neutral-secondary']}
            fontSize="10"
            x={GRAPH_SOURCE_X - 2}
            y={sourceY - 14}
            textAnchor="middle">
            store
          </SvgText>

          {graphNodes.map(node => {
            const color = statusColors[node.status];
            const isSelected = node.key === selectedKey;

            return (
              <React.Fragment key={node.key}>
                <Path
                  d={node.path}
                  fill="none"
                  stroke={color}
                  strokeDasharray={node.isDeleting ? '4 5' : undefined}
                  strokeLinecap="round"
                  strokeOpacity={
                    isSelected ? 0.78 : node.isHighlighted ? 0.54 : 0.26
                  }
                  strokeWidth={
                    isSelected ? 2.2 : node.isHighlighted ? 1.8 : 1.25
                  }
                />

                {(isSelected ||
                  node.isHighlighted ||
                  node.status === 'loading') && (
                  <Circle
                    cx={node.x}
                    cy={node.y}
                    fill={color}
                    opacity={isSelected ? 0.22 : 0.14}
                    r={isSelected ? NODE_RADIUS + 6 : NODE_RADIUS + 4}
                  />
                )}

                <Circle
                  cx={node.x}
                  cy={node.y}
                  fill={color}
                  r={NODE_RADIUS}
                  stroke={color}
                  strokeWidth={isSelected ? 2.4 : 1.5}
                />

                {node.badgeLabel ? (
                  <SvgText
                    fill={color}
                    fontSize="9"
                    fontWeight="600"
                    x={node.x}
                    y={node.y + 18}
                    textAnchor="middle">
                    {node.badgeLabel}
                  </SvgText>
                ) : null}
              </React.Fragment>
            );
          })}

          <Circle
            cx={GRAPH_SOURCE_X}
            cy={sourceY}
            fill={statusColors.source}
            opacity={0.18}
            r={NODE_RADIUS + 6}
          />
          <Circle
            cx={GRAPH_SOURCE_X}
            cy={sourceY}
            fill={statusColors.source}
            r={NODE_RADIUS + 1}
          />
        </Svg>
      </View>
    </View>
  );
}

function AccountRow({
  node,
  isSelected,
  onPress,
  onDelete,
  onOpenDetail,
  onRefreshAccounts,
  onSelect,
}: {
  node: AccountPlaygroundNode;
  isSelected: boolean;
  onPress: () => void;
  onDelete: () => void;
  onOpenDetail: () => void;
  onRefreshAccounts: () => void;
  onSelect: () => void;
}) {
  const { styles } = useTheme2024({ getStyle, isLight: true });
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const removingVisualStage = useAccountRemovingVisualStage(node.account);
  const handleRemovingVisualFinished = React.useCallback(() => {
    void storeApiAccounts.finishRemovingAccountVisual(node.account);
  }, [node.account]);
  const deletingOpacityStyle = useDeletingOpacity(
    removingVisualStage,
    handleRemovingVisualFinished,
  );

  const tone = getStatusTone(node.status);

  const menuActions = React.useMemo<MenuAction[]>(() => {
    return [
      {
        title: 'Open Address Detail',
        icon: isDarkTheme ? MENU_ICONS.moreDark : MENU_ICONS.more,
        key: 'open-detail',
        androidIconName: 'ic_rabby_menu_more',
        action() {
          onSelect();
          onOpenDetail();
        },
      },
      {
        title: 'Refresh All Accounts',
        icon: isDarkTheme ? MENU_ICONS.refreshDark : MENU_ICONS.refresh,
        key: 'refresh-accounts',
        androidIconName: 'ic_rabby_menu_refresh',
        action() {
          onSelect();
          onRefreshAccounts();
        },
      },
      {
        title: 'Delete Account',
        icon: isDarkTheme ? MENU_ICONS.deleteDark : MENU_ICONS.delete,
        key: 'delete-account',
        androidIconName: 'ic_rabby_menu_delete',
        destructive: true,
        action() {
          onSelect();
          onDelete();
        },
      },
    ];
  }, [isDarkTheme, onDelete, onOpenDetail, onRefreshAccounts, onSelect]);

  const content = (
    <Animated.View style={deletingOpacityStyle}>
      <TouchableOpacity
        activeOpacity={node.isDeleting ? 1 : 0.88}
        disabled={node.isDeleting}
        onPress={onPress}>
        <View
          style={[
            styles.accountCard,
            isSelected && styles.accountCardSelected,
            node.isHighlighted && styles.accountCardHighlighted,
            node.isDeleting && styles.accountCardDeleting,
          ]}>
          <AddressItem account={node.account}>
            {({ WalletAddress, WalletBalance, WalletIcon, WalletName }) => (
              <>
                <View style={styles.accountMainRow}>
                  <View style={styles.accountIdentity}>
                    <WalletIcon width={42} height={42} borderRadius={12} />
                    <View style={styles.accountIdentityTexts}>
                      <WalletName style={styles.accountAliasText} />
                      <WalletAddress style={styles.accountAddressText} />
                    </View>
                  </View>

                  <View style={styles.accountRight}>
                    <WalletBalance style={styles.accountBalanceText} />
                    <View style={styles.accountStatusDotWrap}>
                      <View
                        style={[
                          styles.accountStatusDot,
                          tone === 'success'
                            ? styles.accountStatusDotSuccess
                            : tone === 'warning'
                            ? styles.accountStatusDotWarning
                            : tone === 'danger'
                            ? styles.accountStatusDotDanger
                            : tone === 'brand'
                            ? styles.accountStatusDotBrand
                            : styles.accountStatusDotMuted,
                        ]}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.accountMetaRow}>
                  <FlowChip
                    label={node.account.brandName || node.account.type}
                    tone="muted"
                  />
                  <FlowChip label={getStatusLabel(node.status)} tone={tone} />
                  {node.sourceOfCurrentValue ? (
                    <FlowChip
                      label={`source ${node.sourceOfCurrentValue}`}
                      tone="brand"
                    />
                  ) : null}
                  {node.flow.persistStatus !== 'idle' ? (
                    <FlowChip
                      label={`persist ${node.flow.persistStatus}`}
                      tone="muted"
                    />
                  ) : null}
                </View>

                <View style={styles.balanceBreakdownRow}>
                  <Text style={styles.balanceBreakdownText}>
                    evm {formatUsdValue(node.evmBalance)}
                  </Text>
                  <Text style={styles.balanceBreakdownText}>
                    appChain {formatUsdValue(node.appChainBalance)}
                  </Text>
                  {hasMeaningfulBalanceDelta(node.balanceDelta) ? (
                    <Text
                      style={[
                        styles.balanceBreakdownText,
                        styles.balanceBreakdownTextDanger,
                      ]}>
                      delta {formatUsdValue(node.balanceDelta)}
                    </Text>
                  ) : null}
                </View>

                {node.isDeleting ? (
                  <Text style={styles.accountDeletingText}>
                    Deleting. Waiting for keyring persist to finish.
                  </Text>
                ) : null}

                {node.flow.lastError?.message ? (
                  <Text style={styles.accountErrorText} numberOfLines={2}>
                    {node.flow.lastError.message}
                  </Text>
                ) : null}
              </>
            )}
          </AddressItem>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (node.isDeleting) {
    return content;
  }

  return (
    <ContextMenuView
      menuConfig={{
        menuTitle: node.account.address,
        menuActions,
      }}
      preViewBorderRadius={18}
      triggerProps={{ action: 'longPress' }}>
      {content}
    </ContextMenuView>
  );
}

export default function DevDataAccountPlayground(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
    isLight: true,
  });
  const { accounts, fetchAccounts } = useAccounts({
    includeRemoving: true,
    includeFinishingVisual: true,
  });
  const isFetchingAccounts = useAccountStore(s => s.isFetchingAccounts);
  const hasFetchedAccounts = useAccountStore(s => s.hasFetchedAccounts);
  const showAddressDetail = useAddressDetailModal();
  const traceEntries = useResourceFlowTraceEntries();
  const actionSheetRef = React.useRef<AppBottomSheetModal>(null);
  const previousKeysRef = React.useRef<string[] | null>(null);
  const clearHighlightTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [selectedAccountKey, setSelectedAccountKey] = React.useState<
    string | null
  >(null);
  const [highlightedKeys, setHighlightedKeys] = React.useState<string[]>([]);
  const [latestAddedLabel, setLatestAddedLabel] = React.useState<string | null>(
    null,
  );

  const accountInputs = React.useMemo(() => {
    return accounts.map(account => ({
      key: makeAccountDebugKey(account),
      account,
      label: account.aliasName || shortEllipsisAddress(account.address, 4),
      resourceKey: makeAccountDebugKey(account),
    }));
  }, [accounts]);

  const resourceKeys = React.useMemo(() => {
    return accountInputs.map(item => item.resourceKey);
  }, [accountInputs]);
  const removingKeys = accountResourceStore.useRemovingKeys();
  const accountAddresses = React.useMemo(() => {
    return accounts.map(account => account.address.toLowerCase());
  }, [accounts]);

  const snapshots = accountResourceStore.useSnapshots(resourceKeys);
  const balanceSnapshots =
    addressBalanceStore.useAddressesSnapshot(accountAddresses);
  const appChainsByAddress =
    appChainResourceStore.useAddressesAppChains(accountAddresses);

  const snapshotMap = React.useMemo(() => {
    return snapshots.reduce((acc, snapshot) => {
      acc[snapshot.resourceKey] = snapshot;
      return acc;
    }, {} as Record<string, (typeof snapshots)[number]>);
  }, [snapshots]);
  const balanceSnapshotMap = React.useMemo(() => {
    return balanceSnapshots.reduce((acc, snapshot) => {
      acc[snapshot.address] = snapshot;
      return acc;
    }, {} as Record<string, (typeof balanceSnapshots)[number]>);
  }, [balanceSnapshots]);
  const appChainSummaryByAddress = React.useMemo(() => {
    return accountAddresses.reduce((acc, address) => {
      const appChains = appChainsByAddress[address] || [];
      acc[address] = {
        appChainBalance: appChains.reduce(
          (total, item) => total + Number(item.netWorth || 0),
          0,
        ),
        appChainCount: appChains.length,
      };
      return acc;
    }, {} as Record<string, { appChainBalance: number; appChainCount: number }>);
  }, [accountAddresses, appChainsByAddress]);

  React.useEffect(() => {
    if (!accountAddresses.length) {
      return;
    }

    useAppChainStore
      .getState()
      .batchGetAppChains(accountAddresses, false)
      .catch(error => {
        console.warn('Failed to sync appchain snapshot for debug page', error);
      });
  }, [accountAddresses]);

  React.useEffect(() => {
    const currentKeys = accountInputs.map(item => item.key);

    if (!previousKeysRef.current) {
      previousKeysRef.current = currentKeys;
      return;
    }

    const prevKeys = new Set(previousKeysRef.current);
    const added = accountInputs.filter(item => !prevKeys.has(item.key));

    if (added.length) {
      if (clearHighlightTimerRef.current) {
        clearTimeout(clearHighlightTimerRef.current);
      }

      setHighlightedKeys(added.map(item => item.key));
      setLatestAddedLabel(added[added.length - 1]?.label || null);
      clearHighlightTimerRef.current = setTimeout(() => {
        setHighlightedKeys([]);
      }, NEW_HIGHLIGHT_DURATION_MS);
    }

    previousKeysRef.current = currentKeys;
  }, [accountInputs]);

  React.useEffect(() => {
    return () => {
      if (clearHighlightTimerRef.current) {
        clearTimeout(clearHighlightTimerRef.current);
      }
    };
  }, []);

  const nodes = React.useMemo<AccountPlaygroundNode[]>(() => {
    const removingKeysSet = new Set(removingKeys);

    return accountInputs.map(item => {
      const snapshot = snapshotMap[item.resourceKey];
      const lowerAddress = item.account.address.toLowerCase();
      const balanceSnapshot = balanceSnapshotMap[lowerAddress];
      const totalBalance = balanceSnapshot?.value?.totalBalance || 0;
      const evmBalance = balanceSnapshot?.value?.evmBalance || 0;
      const appChainSummary = appChainSummaryByAddress[lowerAddress] || {
        appChainBalance: 0,
        appChainCount: 0,
      };
      const rawDelta =
        totalBalance - (evmBalance + appChainSummary.appChainBalance);
      const isDeleting = removingKeysSet.has(item.resourceKey);

      let status: DebugNodeStatus = 'idle';

      if (isDeleting) {
        status = 'deleting';
      } else if (snapshot?.flow.lastError) {
        status = 'error';
      } else if (snapshot?.flow.isLoading) {
        status = 'loading';
      } else if (snapshot?.flow.hasValue) {
        status = 'ready';
      }

      return {
        key: item.key,
        account: item.account,
        label: item.label,
        resourceKey: item.resourceKey,
        status,
        persistStatus: snapshot?.persistStatus || 'idle',
        flow:
          snapshot?.flow || accountResourceStore.getFlowState(item.resourceKey),
        sourceOfCurrentValue: snapshot?.sourceOfCurrentValue,
        totalBalance,
        evmBalance,
        appChainBalance: appChainSummary.appChainBalance,
        appChainCount: appChainSummary.appChainCount,
        balanceDelta: hasMeaningfulBalanceDelta(rawDelta) ? rawDelta : 0,
        isHighlighted: highlightedKeys.includes(item.key),
        isDeleting,
      };
    });
  }, [
    accountInputs,
    appChainSummaryByAddress,
    balanceSnapshotMap,
    highlightedKeys,
    removingKeys,
    snapshotMap,
  ]);

  const summary = React.useMemo(() => {
    return nodes.reduce(
      (acc, node) => {
        acc.total += 1;

        if (node.status === 'ready') {
          acc.ready += 1;
        } else if (node.status === 'loading') {
          acc.loading += 1;
        } else if (node.status === 'deleting') {
          acc.deleting += 1;
        } else if (node.status === 'error') {
          acc.error += 1;
        } else {
          acc.idle += 1;
        }

        if (node.appChainBalance > BALANCE_DELTA_EPSILON) {
          acc.hasAppChain += 1;
        }

        if (hasMeaningfulBalanceDelta(node.balanceDelta)) {
          acc.deltaMismatch += 1;
        }

        return acc;
      },
      {
        total: 0,
        ready: 0,
        loading: 0,
        deleting: 0,
        error: 0,
        idle: 0,
        hasAppChain: 0,
        deltaMismatch: 0,
      },
    );
  }, [nodes]);

  const selectedNode = React.useMemo(() => {
    if (!selectedAccountKey) {
      return null;
    }

    return nodes.find(node => node.key === selectedAccountKey) || null;
  }, [nodes, selectedAccountKey]);

  React.useEffect(() => {
    if (!nodes.length) {
      setSelectedAccountKey(null);
      return;
    }

    if (!selectedAccountKey) {
      setSelectedAccountKey(nodes[0]?.key || null);
      return;
    }

    if (!nodes.some(node => node.key === selectedAccountKey)) {
      setSelectedAccountKey(nodes[0]?.key || null);
      actionSheetRef.current?.dismiss();
    }
  }, [nodes, selectedAccountKey]);

  const selectedTraceEntries = React.useMemo(() => {
    if (!selectedNode?.resourceKey) {
      return [];
    }

    return traceEntries
      .filter(entry => {
        return (
          entry.family === 'account' &&
          entry.resourceKey === selectedNode.resourceKey
        );
      })
      .slice(-8)
      .reverse();
  }, [selectedNode?.resourceKey, traceEntries]);

  const selectedFlowLabels = React.useMemo(() => {
    return selectedNode
      ? [
          `status ${getStatusLabel(selectedNode.status)}`,
          selectedNode.isDeleting ? 'deleting in progress' : null,
          selectedNode.sourceOfCurrentValue
            ? `source ${selectedNode.sourceOfCurrentValue}`
            : null,
          selectedNode.flow.persistStatus !== 'idle'
            ? `persist ${selectedNode.flow.persistStatus}`
            : null,
        ].filter((label): label is string => !!label)
      : [];
  }, [selectedNode]);

  const dismissActionSheet = React.useCallback(() => {
    actionSheetRef.current?.dismiss();
  }, []);

  const handleOpenAddressDetail = React.useCallback(
    (account: KeyringAccountWithAlias) => {
      dismissActionSheet();
      showAddressDetail({
        account,
      });
    },
    [dismissActionSheet, showAddressDetail],
  );

  const handleDeleteAccount = React.useCallback(
    (account: KeyringAccountWithAlias) => {
      dismissActionSheet();
      void showDeleteAccountModal({
        account,
        successMessage: 'Account deleted',
      });
    },
    [dismissActionSheet],
  );

  const handleRowPress = React.useCallback((node: AccountPlaygroundNode) => {
    setSelectedAccountKey(node.key);
    actionSheetRef.current?.present();
  }, []);

  const listHeader = React.useMemo(() => {
    return (
      <View>
        <View style={styles.summaryCard}>
          <SectionHeader title="Summary" />
          <View style={styles.summaryGrid}>
            <SummaryBadge label={`accounts ${summary.total}`} tone="brand" />
            <SummaryBadge
              label={
                isFetchingAccounts
                  ? 'store fetching'
                  : hasFetchedAccounts
                  ? 'store ready'
                  : 'store idle'
              }
              tone={isFetchingAccounts ? 'warning' : 'muted'}
            />
            <SummaryBadge label={`ready ${summary.ready}`} tone="success" />
            <SummaryBadge label={`loading ${summary.loading}`} tone="warning" />
            <SummaryBadge
              label={`deleting ${summary.deleting}`}
              tone={summary.deleting ? 'danger' : 'muted'}
            />
            <SummaryBadge label={`error ${summary.error}`} tone="danger" />
            <SummaryBadge label={`idle ${summary.idle}`} tone="muted" />
            <SummaryBadge
              label={`appchain>0 ${summary.hasAppChain}`}
              tone="brand"
            />
            <SummaryBadge
              label={`delta ${summary.deltaMismatch}`}
              tone={summary.deltaMismatch ? 'warning' : 'muted'}
            />
          </View>

          {latestAddedLabel ? (
            <Text style={styles.helperText}>
              Latest added: {latestAddedLabel}
            </Text>
          ) : null}
        </View>

        <AccountGraph nodes={nodes} selectedKey={selectedAccountKey} />

        <SectionHeader
          title="Accounts"
          hint={`${nodes.length} rows · tap for actions and flow`}
        />
      </View>
    );
  }, [
    hasFetchedAccounts,
    isFetchingAccounts,
    latestAddedLabel,
    nodes,
    selectedAccountKey,
    styles,
    summary.error,
    summary.hasAppChain,
    summary.idle,
    summary.loading,
    summary.ready,
    summary.deltaMismatch,
    summary.deleting,
    summary.total,
  ]);

  return (
    <>
      <FooterButtonScreenContainer
        as="View"
        style={styles.screen}
        footerContainerHeight={FOOTER_CONTAINER_HEIGHT}
        buttonProps={{
          title: 'Refresh All Accounts',
          onPress: () => {
            fetchAccounts().catch(() => {
              toast.error('Refresh accounts failed');
            });
          },
        }}
        footerContainerStyle={styles.footerContainer}>
        <FlatList
          data={nodes}
          keyExtractor={item => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          ListFooterComponent={<View style={styles.listFooterGap} />}
          ItemSeparatorComponent={ItemSeparator}
          renderItem={({ item }) => (
            <AccountRow
              node={item}
              isSelected={selectedAccountKey === item.key}
              onPress={() => {
                handleRowPress(item);
              }}
              onSelect={() => {
                setSelectedAccountKey(item.key);
              }}
              onOpenDetail={() => {
                handleOpenAddressDetail(item.account);
              }}
              onRefreshAccounts={() => {
                fetchAccounts().catch(() => {
                  toast.error('Refresh accounts failed');
                });
              }}
              onDelete={() => {
                handleDeleteAccount(item.account);
              }}
            />
          )}
        />
      </FooterButtonScreenContainer>

      <AppBottomSheetModal
        ref={actionSheetRef}
        index={0}
        snapPoints={ACTION_SHEET_SNAP_POINTS}
        enableDismissOnClose
        onDismiss={() => null}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}>
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}>
          <AppBottomSheetModalTitle
            title={selectedNode?.label || 'Account Playground'}
          />

          {selectedNode ? (
            <>
              <Text style={styles.sheetAddress}>
                {selectedNode.account.address}
              </Text>
              <Text style={styles.sheetDescription}>
                {selectedNode.isDeleting
                  ? 'Deleting is in progress. This row stays visible but non-interactive until the keyring delete really finishes.'
                  : 'Open Address Detail and Delete Account both use the real business flows. Refresh All Accounts replays the list-level account snapshot fetch/hydrate path for this resource family.'}
              </Text>

              <View style={styles.sheetFlowRow}>
                <FlowChip
                  label={getStatusLabel(selectedNode.status)}
                  tone={getStatusTone(selectedNode.status)}
                />
                {selectedNode.sourceOfCurrentValue ? (
                  <FlowChip
                    label={`source ${selectedNode.sourceOfCurrentValue}`}
                    tone="brand"
                  />
                ) : null}
                {selectedNode.flow.persistStatus !== 'idle' ? (
                  <FlowChip
                    label={`persist ${selectedNode.flow.persistStatus}`}
                    tone="muted"
                  />
                ) : null}
              </View>

              <Button
                title="Refresh All Accounts"
                type="primary"
                height={48}
                disabled={selectedNode.isDeleting}
                loading={isFetchingAccounts}
                containerStyle={styles.sheetButton}
                onPress={() => {
                  fetchAccounts().catch(() => {
                    toast.error('Refresh accounts failed');
                  });
                }}
              />

              <Button
                title="Open Address Detail"
                type="ghost"
                height={48}
                disabled={selectedNode.isDeleting}
                containerStyle={styles.sheetButton}
                onPress={() => {
                  handleOpenAddressDetail(selectedNode.account);
                }}
              />

              <Button
                title="Delete Account"
                type="danger"
                height={48}
                disabled={selectedNode.isDeleting}
                containerStyle={styles.sheetButton}
                onPress={() => {
                  handleDeleteAccount(selectedNode.account);
                }}
              />

              <Button
                title="Close"
                type="ghost"
                height={48}
                containerStyle={styles.sheetButton}
                onPress={dismissActionSheet}
              />

              <View style={styles.sheetSection}>
                <SectionHeader title="Selected Flow" />

                <View style={styles.summaryGrid}>
                  {selectedFlowLabels.map(label => (
                    <SummaryBadge
                      key={`${selectedNode.key}-${label}`}
                      label={label}
                    />
                  ))}
                </View>

                <View style={styles.balanceDebugCard}>
                  <Text style={styles.traceTitle}>Balance Breakdown</Text>
                  <View style={styles.summaryGrid}>
                    <SummaryBadge
                      label={`total ${formatUsdValue(
                        selectedNode.totalBalance,
                      )}`}
                      tone="brand"
                    />
                    <SummaryBadge
                      label={`evm ${formatUsdValue(selectedNode.evmBalance)}`}
                      tone="muted"
                    />
                    <SummaryBadge
                      label={`appChain ${formatUsdValue(
                        selectedNode.appChainBalance,
                      )}`}
                      tone={
                        selectedNode.appChainBalance > BALANCE_DELTA_EPSILON
                          ? 'success'
                          : 'muted'
                      }
                    />
                    <SummaryBadge
                      label={`appChains ${selectedNode.appChainCount}`}
                      tone="muted"
                    />
                    {hasMeaningfulBalanceDelta(selectedNode.balanceDelta) ? (
                      <SummaryBadge
                        label={`delta ${formatUsdValue(
                          selectedNode.balanceDelta,
                        )}`}
                        tone="warning"
                      />
                    ) : null}
                  </View>
                  <Text style={styles.selectedHelp}>
                    Reference: balance = evmBalance + appChainBalance
                  </Text>
                </View>

                <Text style={styles.selectedMeta}>
                  resourceKey: {selectedNode.resourceKey}
                </Text>

                {selectedNode.flow.lastError?.message ? (
                  <Text style={styles.selectedError}>
                    {selectedNode.flow.lastError.message}
                  </Text>
                ) : null}

                <View style={styles.traceCard}>
                  <Text style={styles.traceTitle}>Recent Trace</Text>
                  {selectedTraceEntries.length ? (
                    selectedTraceEntries.map(entry => (
                      <View key={entry.id} style={styles.traceItem}>
                        <Text style={styles.traceLine}>
                          {formatTraceLine(entry)}
                        </Text>
                        {entry.error?.message ? (
                          <Text style={styles.traceError}>
                            {entry.error.message}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyTraceText}>
                      No trace entry yet. Try Refresh All Accounts, add an
                      account, or delete this account.
                    </Text>
                  )}
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.emptyTraceText}>No account selected.</Text>
          )}
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    </>
  );
}

const ItemSeparator = () => <View style={ITEM_SEPARATOR_STYLE} />;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  footerContainer: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors2024['neutral-line'],
  },
  listContent: {
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 24,
  },
  listFooterGap: {
    height: FOOTER_CONTAINER_HEIGHT + 28,
  },
  summaryCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-card-1'],
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  sectionHint: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  summaryGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryBadgeMuted: {
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-2'],
  },
  summaryBadgeBrand: {
    borderColor: colors2024['brand-light-1'],
    backgroundColor: colors2024['brand-light-1'],
  },
  summaryBadgeSuccess: {
    borderColor: 'rgba(21, 195, 126, 0.18)',
    backgroundColor: 'rgba(21, 195, 126, 0.12)',
  },
  summaryBadgeWarning: {
    borderColor: 'rgba(255, 165, 0, 0.18)',
    backgroundColor: 'rgba(255, 165, 0, 0.12)',
  },
  summaryBadgeDanger: {
    borderColor: 'rgba(255, 107, 107, 0.18)',
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  summaryBadgeText: {
    color: colors2024['neutral-body'],
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  helperText: {
    marginTop: 10,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  graphCard: {
    marginTop: 16,
    padding: GRAPH_CARD_INNER_PADDING,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-card-1'],
  },
  legendRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  graphCanvasWrap: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  graphCanvas: {
    alignSelf: 'center',
  },
  flowChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  flowChipCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  flowChipMuted: {
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-2'],
  },
  flowChipBrand: {
    borderColor: colors2024['brand-light-1'],
    backgroundColor: colors2024['brand-light-1'],
  },
  flowChipSuccess: {
    borderColor: 'rgba(21, 195, 126, 0.18)',
    backgroundColor: 'rgba(21, 195, 126, 0.12)',
  },
  flowChipWarning: {
    borderColor: 'rgba(255, 165, 0, 0.18)',
    backgroundColor: 'rgba(255, 165, 0, 0.12)',
  },
  flowChipDanger: {
    borderColor: 'rgba(255, 107, 107, 0.18)',
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  flowChipText: {
    color: colors2024['neutral-title-1'],
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  flowChipTextCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  selectedTitle: {
    marginTop: 12,
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  selectedAddress: {
    marginTop: 4,
    color: colors2024['neutral-secondary'],
    fontSize: 13,
    lineHeight: 18,
  },
  selectedMeta: {
    marginTop: 10,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    lineHeight: 16,
  },
  selectedHelp: {
    marginTop: 8,
    color: colors2024['neutral-secondary'],
    fontSize: 12,
    lineHeight: 17,
  },
  selectedError: {
    marginTop: 8,
    color: colors2024['red-default'],
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  traceCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  traceTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  traceItem: {
    marginTop: 10,
  },
  traceLine: {
    color: colors2024['neutral-body'],
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  traceError: {
    marginTop: 3,
    color: colors2024['red-default'],
    fontSize: 12,
    lineHeight: 16,
  },
  emptyTraceText: {
    marginTop: 12,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    lineHeight: 16,
  },
  accountCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-card-1'],
  },
  accountCardSelected: {
    borderColor: colors2024['brand-default'],
    backgroundColor: colors2024['brand-light-1'],
  },
  accountCardHighlighted: {
    shadowColor: colors2024['brand-default'],
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },
  accountCardDeleting: {
    borderColor: 'rgba(255, 107, 107, 0.28)',
  },
  accountMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  accountIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accountIdentityTexts: {
    flex: 1,
    gap: 4,
  },
  accountAliasText: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  accountAddressText: {
    color: colors2024['neutral-secondary'],
    fontSize: 13,
    lineHeight: 18,
  },
  accountRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  accountBalanceText: {
    color: colors2024['neutral-title-1'],
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  accountStatusDotWrap: {
    height: 10,
    justifyContent: 'center',
  },
  accountStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
  },
  accountStatusDotMuted: {
    backgroundColor: 'rgba(135, 145, 161, 0.46)',
  },
  accountStatusDotBrand: {
    backgroundColor: colors2024['brand-default'],
  },
  accountStatusDotSuccess: {
    backgroundColor: colors2024['green-default'],
  },
  accountStatusDotWarning: {
    backgroundColor: colors2024['orange-default'],
  },
  accountStatusDotDanger: {
    backgroundColor: colors2024['red-default'],
  },
  accountMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  balanceBreakdownRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  balanceBreakdownText: {
    color: colors2024['neutral-secondary'],
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  balanceBreakdownTextDanger: {
    color: colors2024['orange-default'],
  },
  accountErrorText: {
    marginTop: 8,
    color: colors2024['red-default'],
    fontSize: 12,
    lineHeight: 16,
  },
  accountDeletingText: {
    marginTop: 8,
    color: colors2024['red-default'],
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  sheetSection: {
    marginTop: 18,
  },
  balanceDebugCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  sheetAddress: {
    color: colors2024['neutral-secondary'],
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  sheetDescription: {
    marginTop: 10,
    color: colors2024['neutral-foot'],
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  sheetFlowRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  sheetButton: {
    marginTop: 12,
  },
}));
