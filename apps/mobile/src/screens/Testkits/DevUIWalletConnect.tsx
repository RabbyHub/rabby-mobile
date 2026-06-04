import React, {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { toast } from '@/components2024/Toast';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { ScreenLayouts } from '@/constant/layout';
import {
  disconnectWalletConnectSession,
  getWalletConnectDebugState,
  getWalletConnectAutoDisconnectEnabled,
  pairWalletConnectUri,
  setWalletConnectAutoDisconnectEnabled,
  subscribeWalletConnectDebugState,
} from '@/core/walletconnect';
import { getWalletConnectErrorMessage } from '@/core/walletconnect/error';
import type {
  WalletConnectDebugLogEntry,
  WalletConnectProposalViewModel,
  WalletConnectSessionViewModel,
} from '@/core/walletconnect/types';
import { useThemeColors } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';

const MAX_VISIBLE_LOGS = 40;

function maskProjectId(projectId: string) {
  if (!projectId) {
    return 'missing';
  }
  if (projectId.length <= 10) {
    return projectId;
  }
  return `${projectId.slice(0, 6)}...${projectId.slice(-4)}`;
}

function formatTime(ts?: number) {
  if (!ts) {
    return '-';
  }
  return new Date(ts).toLocaleString();
}

function formatList(values: string[], empty = 'none') {
  return values.length ? values.join(', ') : empty;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.labelText}>{label}</Text>
      <Text style={styles.valueText}>{value}</Text>
    </View>
  );
}

function EmptyText({ value }: { value: string }) {
  return <Text style={styles.emptyText}>{value}</Text>;
}

function AutoDisconnectSwitchRow({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex1}>
        <Text style={styles.labelText}>Auto Disconnect</Text>
        <Text style={styles.mutedText}>
          Keep one active session, replace new connections, and drop inactive
          sessions.
        </Text>
      </View>
      <AppSwitch2024 circleSize={20} value={enabled} onValueChange={onChange} />
    </View>
  );
}

function ManualPairingSection({
  value,
  loading,
  onChange,
  onConnect,
}: {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onConnect: () => void;
}) {
  return (
    <Section title="Manual Pairing">
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="wc:..."
        placeholderTextColor="#8A94A6"
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        style={styles.uriInput}
      />
      <Button
        title="Connect"
        type="primary"
        height={40}
        loading={loading}
        disabled={!value.trim() || loading}
        containerStyle={styles.connectUriButton}
        buttonStyle={styles.smallButton}
        titleStyle={styles.smallButtonTitle}
        onPress={onConnect}
      />
    </Section>
  );
}

function DappHeader({
  name,
  url,
  icon,
}: {
  name: string;
  url?: string;
  icon?: string;
}) {
  return (
    <View style={styles.dappHeader}>
      {icon ? <Image source={{ uri: icon }} style={styles.dappIcon} /> : null}
      <View style={styles.flex1}>
        <Text style={styles.dappName}>{name}</Text>
        <Text style={styles.mutedText} numberOfLines={1}>
          {url || 'No URL'}
        </Text>
      </View>
    </View>
  );
}

function ProposalSection({
  proposal,
}: {
  proposal?: WalletConnectProposalViewModel;
}) {
  if (!proposal) {
    return (
      <Section title="Current Proposal">
        <EmptyText value="No pending proposal" />
      </Section>
    );
  }

  return (
    <Section title="Current Proposal">
      <DappHeader
        name={proposal.proposer.name}
        url={proposal.proposer.url}
        icon={proposal.proposer.icons?.[0]}
      />
      <KeyValue label="ID" value={String(proposal.id)} />
      <KeyValue label="Source" value={proposal.source} />
      <KeyValue label="Received" value={formatTime(proposal.receivedAt)} />
      <Text style={styles.mutedText}>
        Chains: {formatList(proposal.requestedChains)}
      </Text>
      <Text style={styles.mutedText}>
        Methods: {formatList(proposal.requestedMethods)}
      </Text>
      {proposal.unsupportedRequiredChains.length ? (
        <Text style={styles.errorText}>
          Unsupported required chains:{' '}
          {formatList(proposal.unsupportedRequiredChains)}
        </Text>
      ) : null}
      {proposal.unsupportedRequiredMethods.length ? (
        <Text style={styles.errorText}>
          Unsupported required methods:{' '}
          {formatList(proposal.unsupportedRequiredMethods)}
        </Text>
      ) : null}
      {proposal.error ? (
        <Text style={styles.errorText}>{proposal.error}</Text>
      ) : null}
    </Section>
  );
}

function SessionCard({
  session,
  disabled,
  loading,
  onDisconnect,
}: {
  session: WalletConnectSessionViewModel;
  disabled: boolean;
  loading: boolean;
  onDisconnect: (topic: string) => Promise<void>;
}) {
  return (
    <View style={styles.card}>
      <DappHeader
        name={session.peer.name}
        url={session.peer.url || session.topic}
        icon={session.peer.icons?.[0]}
      />
      <KeyValue
        label="Account"
        value={
          session.selectedAccount?.address
            ? ellipsisAddress(session.selectedAccount.address)
            : 'unknown'
        }
      />
      <Text style={styles.mutedText}>Chains: {formatList(session.chains)}</Text>
      <Text style={styles.mutedText}>
        Methods: {formatList(session.methods)}
      </Text>
      <Text style={styles.logData} numberOfLines={2}>
        {session.topic}
      </Text>
      <Button
        title="Disconnect"
        type="danger"
        height={36}
        loading={loading}
        disabled={disabled}
        containerStyle={styles.sessionActionButton}
        buttonStyle={styles.smallButton}
        titleStyle={styles.smallButtonTitle}
        onPress={() => {
          void onDisconnect(session.topic);
        }}
      />
    </View>
  );
}

function SessionsSection({
  sessions,
  disconnectingTopic,
  onDisconnect,
  onDisconnectAll,
}: {
  sessions: WalletConnectSessionViewModel[];
  disconnectingTopic: string | 'all' | null;
  onDisconnect: (topic: string) => Promise<void>;
  onDisconnectAll: () => Promise<void>;
}) {
  const hasSessions = sessions.length > 0;
  const isDisconnecting = disconnectingTopic !== null;

  return (
    <Section title={`Sessions (${sessions.length})`}>
      {hasSessions ? (
        <View style={styles.sectionActionRow}>
          <Button
            title="Disconnect All"
            type="plain"
            height={36}
            loading={disconnectingTopic === 'all'}
            disabled={isDisconnecting}
            containerStyle={styles.disconnectAllButton}
            buttonStyle={styles.smallButton}
            titleStyle={styles.disconnectAllButtonTitle}
            onPress={() => {
              void onDisconnectAll();
            }}
          />
        </View>
      ) : null}
      {!hasSessions ? (
        <EmptyText value="No active sessions" />
      ) : (
        sessions.map(session => (
          <SessionCard
            key={session.topic}
            session={session}
            disabled={isDisconnecting}
            loading={disconnectingTopic === session.topic}
            onDisconnect={onDisconnect}
          />
        ))
      )}
    </Section>
  );
}

function LogRow({ item }: { item: WalletConnectDebugLogEntry }) {
  return (
    <View style={styles.logRow}>
      <Text style={styles.logTitle}>
        {new Date(item.ts).toLocaleTimeString()} [{item.level}] {item.scope}
      </Text>
      <Text style={styles.mutedText}>{item.message}</Text>
      {item.data ? (
        <Text style={styles.logData} numberOfLines={8}>
          {item.data}
        </Text>
      ) : null}
    </View>
  );
}

function RecentLogSection({ log }: { log: WalletConnectDebugLogEntry[] }) {
  return (
    <Section title="Recent Log">
      {!log.length ? (
        <EmptyText value="No events yet" />
      ) : (
        log.map(item => <LogRow key={item.id} item={item} />)
      )}
    </Section>
  );
}

export default function WalletConnectLogScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [disconnectingTopic, setDisconnectingTopic] = useState<
    string | 'all' | null
  >(null);
  const [uriInput, setUriInput] = useState('');
  const [isPairingUri, setIsPairingUri] = useState(false);
  const [autoDisconnectEnabled, setAutoDisconnectEnabledState] = useState(
    getWalletConnectAutoDisconnectEnabled,
  );
  const walletConnectState = useSyncExternalStore(
    subscribeWalletConnectDebugState,
    getWalletConnectDebugState,
    getWalletConnectDebugState,
  );
  const visibleLog = useMemo(
    () => walletConnectState.log.slice(0, MAX_VISIBLE_LOGS),
    [walletConnectState.log],
  );
  const contentStyle = useMemo(
    () => [
      styles.content,
      { paddingTop: insets.top + ScreenLayouts.headerAreaHeight + 16 },
    ],
    [insets.top],
  );

  const handleDisconnectSession = useCallback(async (topic: string) => {
    setDisconnectingTopic(topic);
    try {
      await disconnectWalletConnectSession(topic);
    } catch (error: unknown) {
      toast.error(getWalletConnectErrorMessage(error));
    } finally {
      setDisconnectingTopic(null);
    }
  }, []);

  const handleDisconnectAllSessions = useCallback(async () => {
    const topics = walletConnectState.sessions.map(session => session.topic);
    if (!topics.length) {
      return;
    }

    setDisconnectingTopic('all');
    let firstError: unknown;
    try {
      for (const topic of topics) {
        try {
          await disconnectWalletConnectSession(topic);
        } catch (error: unknown) {
          firstError = firstError || error;
        }
      }
      if (firstError) {
        toast.error(getWalletConnectErrorMessage(firstError));
      }
    } finally {
      setDisconnectingTopic(null);
    }
  }, [walletConnectState.sessions]);

  const handleConnectUri = useCallback(async () => {
    const uri = uriInput.trim();
    if (!uri || isPairingUri) {
      return;
    }

    setIsPairingUri(true);
    try {
      await pairWalletConnectUri({
        uri,
        source: 'manual',
      });
      setUriInput('');
    } catch (error: unknown) {
      toast.error(getWalletConnectErrorMessage(error));
    } finally {
      setIsPairingUri(false);
    }
  }, [isPairingUri, uriInput]);

  const handleAutoDisconnectChange = useCallback((enabled: boolean) => {
    setWalletConnectAutoDisconnectEnabled(enabled);
    setAutoDisconnectEnabledState(enabled);
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors['neutral-bg-1'] }]}
      contentContainerStyle={contentStyle}>
      <Section title="Status">
        <KeyValue
          label="Project ID"
          value={maskProjectId(walletConnectState.projectId)}
        />
        <KeyValue label="Client" value={walletConnectState.client.status} />
        <KeyValue label="Pairing" value={walletConnectState.pairing.status} />
        {walletConnectState.client.error ? (
          <Text style={styles.errorText}>
            {walletConnectState.client.error}
          </Text>
        ) : null}
        {walletConnectState.pairing.error ? (
          <Text style={styles.errorText}>
            {walletConnectState.pairing.error}
          </Text>
        ) : null}
        <AutoDisconnectSwitchRow
          enabled={autoDisconnectEnabled}
          onChange={handleAutoDisconnectChange}
        />
      </Section>
      <ManualPairingSection
        value={uriInput}
        loading={isPairingUri}
        onChange={setUriInput}
        onConnect={handleConnectUri}
      />
      <ProposalSection proposal={walletConnectState.proposal} />
      <SessionsSection
        sessions={walletConnectState.sessions}
        disconnectingTopic={disconnectingTopic}
        onDisconnect={handleDisconnectSession}
        onDisconnectAll={handleDisconnectAllSessions}
      />
      <RecentLogSection log={visibleLog} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  section: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8DEE8',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#192945',
  },
  card: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1E6EF',
    backgroundColor: '#F7F9FC',
    padding: 12,
    gap: 8,
  },
  sectionActionRow: {
    alignItems: 'flex-end',
  },
  disconnectAllButton: {
    width: 154,
  },
  disconnectAllButtonTitle: {
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: '700',
  },
  sessionActionButton: {
    alignSelf: 'flex-end',
    width: 128,
  },
  smallButton: {
    borderRadius: 8,
    height: 36,
  },
  smallButtonTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  uriInput: {
    minHeight: 92,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8DEE8',
    backgroundColor: '#F7F9FC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#192945',
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  connectUriButton: {
    alignSelf: 'flex-end',
    width: 128,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 2,
  },
  labelText: {
    color: '#5D6B82',
    fontSize: 13,
  },
  valueText: {
    color: '#192945',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  dappHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dappIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EEF2F7',
  },
  dappName: {
    color: '#192945',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  mutedText: {
    color: '#5D6B82',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: '#8A94A6',
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    lineHeight: 18,
  },
  logRow: {
    borderRadius: 8,
    backgroundColor: '#F7F9FC',
    padding: 10,
    gap: 5,
  },
  logTitle: {
    color: '#192945',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  logData: {
    color: '#3B4A62',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Menlo',
  },
  flex1: {
    flex: 1,
  },
});
