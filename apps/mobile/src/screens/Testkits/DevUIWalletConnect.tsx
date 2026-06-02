import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';
import { Text, TextInput } from '@/components/Typography';
import { useMyAccounts } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import type { Account } from '@/types/account';
import {
  approveWalletConnectProposal,
  disconnectWalletConnectSession,
  getWalletConnectDebugState,
  initWalletConnectForTest,
  pairWalletConnectUri,
  refreshWalletConnectSessionsForTest,
  rejectWalletConnectProposal,
  subscribeWalletConnectDebugState,
} from '@/core/walletconnect';

function maskProjectId(projectId: string) {
  if (!projectId) {
    return 'missing';
  }
  if (projectId.length <= 10) {
    return projectId;
  }
  return `${projectId.slice(0, 6)}...${projectId.slice(-4)}`;
}

function accountKey(account: Account) {
  return `${account.type}:${account.brandName}:${account.address}`;
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

function Button({
  label,
  onPress,
  disabled,
  variant = 'default',
}: {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  variant?: 'default' | 'secondary' | 'danger';
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        disabled && styles.disabledButton,
      ]}>
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' && styles.secondaryButtonText,
          disabled && styles.disabledButtonText,
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StatusText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.statusText}>{children}</Text>;
}

export default function DevUIWalletConnect() {
  const colors = useThemeColors();
  const walletConnectState = useSyncExternalStore(
    subscribeWalletConnectDebugState,
    getWalletConnectDebugState,
    getWalletConnectDebugState,
  );
  const { accounts } = useMyAccounts();
  const [uri, setUri] = useState('');
  const [selectedAccountKey, setSelectedAccountKey] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const lastScannedUriRef = useRef('');

  const selectedAccount = useMemo(
    () =>
      accounts.find(account => accountKey(account) === selectedAccountKey) ||
      accounts[0],
    [accounts, selectedAccountKey],
  );

  useEffect(() => {
    if (!selectedAccountKey && accounts[0]) {
      setSelectedAccountKey(accountKey(accounts[0]));
    }
  }, [accounts, selectedAccountKey]);

  const runAction = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError('');
    try {
      await fn();
    } catch (error: any) {
      setActionError(error?.message || String(error));
    } finally {
      setBusy(false);
    }
  }, []);

  const handlePaste = useCallback(() => {
    Clipboard.getString().then(value => {
      setUri(value || '');
    });
  }, []);

  const connectUri = useCallback(
    (source: 'manual' | 'qr') =>
      runAction(async () => {
        await pairWalletConnectUri({
          uri,
          source,
        });
      }),
    [runAction, uri],
  );

  const handleCodeScanned = useCallback(
    (codes: { value?: string | null }[]) => {
      const nextUri = codes.find(code => !!code.value)?.value?.trim();
      if (!nextUri || lastScannedUriRef.current === nextUri) {
        return;
      }
      lastScannedUriRef.current = nextUri;
      setUri(nextUri);
      runAction(async () => {
        await pairWalletConnectUri({
          uri: nextUri,
          source: 'qr',
        });
      });
    },
    [runAction],
  );

  const proposal = walletConnectState.proposal;
  const projectIdText = maskProjectId(walletConnectState.projectId);
  const visibleLog = walletConnectState.log.slice(0, 20);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors['neutral-bg-1'] }]}
      contentContainerStyle={styles.content}>
      <Section title="Client">
        <View style={styles.rowBetween}>
          <StatusText>Project ID</StatusText>
          <Text style={styles.valueText}>{projectIdText}</Text>
        </View>
        <View style={styles.rowBetween}>
          <StatusText>Init</StatusText>
          <Text style={styles.valueText}>
            {walletConnectState.client.status}
          </Text>
        </View>
        {walletConnectState.client.error ? (
          <Text style={styles.errorText}>
            {walletConnectState.client.error}
          </Text>
        ) : null}
        <Button
          label="Init WalletKit"
          disabled={busy}
          onPress={() => runAction(initWalletConnectForTest)}
        />
      </Section>

      <Section title="QR Scanner">
        <QRCodeScanner
          showScanLine
          onCodeScanned={handleCodeScanned}
          containerStyle={styles.scanner}
          size={250}
        />
      </Section>

      <Section title="URI Input">
        <TextInput
          value={uri}
          onChangeText={setUri}
          placeholder="wc:... or rabby://walletconnect?uri=..."
          placeholderTextColor="#8A94A6"
          multiline
          style={styles.uriInput}
        />
        <View style={styles.buttonRow}>
          <Button
            label="Paste"
            disabled={busy}
            variant="secondary"
            onPress={handlePaste}
          />
          <Button
            label="Clear"
            disabled={busy}
            variant="secondary"
            onPress={() => setUri('')}
          />
          <Button
            label="Connect"
            disabled={busy || !uri.trim()}
            onPress={() => connectUri('manual')}
          />
        </View>
        <View style={styles.rowBetween}>
          <StatusText>Pairing</StatusText>
          <Text style={styles.valueText}>
            {walletConnectState.pairing.status}
          </Text>
        </View>
        {walletConnectState.pairing.error ? (
          <Text style={styles.errorText}>
            {walletConnectState.pairing.error}
          </Text>
        ) : null}
        {actionError ? (
          <Text style={styles.errorText}>{actionError}</Text>
        ) : null}
      </Section>

      <Section title="Proposal">
        {!proposal ? (
          <Text style={styles.emptyText}>No pending proposal</Text>
        ) : (
          <View>
            <View style={styles.dappHeader}>
              {proposal.proposer.icons?.[0] ? (
                <Image
                  source={{ uri: proposal.proposer.icons[0] }}
                  style={styles.dappIcon}
                />
              ) : null}
              <View style={styles.flex1}>
                <Text style={styles.dappName}>{proposal.proposer.name}</Text>
                <Text style={styles.mutedText} numberOfLines={1}>
                  {proposal.proposer.url || 'No URL'}
                </Text>
              </View>
            </View>
            <Text style={styles.mutedText}>Source: {proposal.source}</Text>
            <Text style={styles.mutedText}>
              Chains: {proposal.requestedChains.join(', ') || 'none'}
            </Text>
            <Text style={styles.mutedText}>
              Methods: {proposal.requestedMethods.join(', ') || 'none'}
            </Text>
            {proposal.unsupportedChains.length ? (
              <Text style={styles.errorText}>
                Unsupported chains: {proposal.unsupportedChains.join(', ')}
              </Text>
            ) : null}
            {proposal.unsupportedMethods.length ? (
              <Text style={styles.errorText}>
                Unsupported methods: {proposal.unsupportedMethods.join(', ')}
              </Text>
            ) : null}
            {proposal.error ? (
              <Text style={styles.errorText}>{proposal.error}</Text>
            ) : null}

            <View style={styles.accountList}>
              {accounts.map(account => {
                const selected =
                  accountKey(account) === accountKey(selectedAccount);
                return (
                  <TouchableOpacity
                    key={accountKey(account)}
                    onPress={() => setSelectedAccountKey(accountKey(account))}
                    style={[
                      styles.accountRow,
                      selected && styles.accountRowSelected,
                    ]}>
                    <Text style={styles.accountName}>
                      {account.aliasName || account.brandName}
                    </Text>
                    <Text style={styles.mutedText}>
                      {ellipsisAddress(account.address)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.buttonRow}>
              <Button
                label="Approve"
                disabled={busy || !selectedAccount}
                onPress={() =>
                  runAction(async () => {
                    if (!selectedAccount) {
                      throw new Error('Select an account before approving.');
                    }
                    await approveWalletConnectProposal({
                      proposalId: proposal.id,
                      account: selectedAccount,
                    });
                  })
                }
              />
              <Button
                label="Reject"
                disabled={busy}
                variant="danger"
                onPress={() =>
                  runAction(async () => {
                    await rejectWalletConnectProposal(proposal.id);
                  })
                }
              />
            </View>
          </View>
        )}
      </Section>

      <Section title="Sessions">
        <Button
          label="Refresh"
          disabled={busy}
          variant="secondary"
          onPress={() => runAction(refreshWalletConnectSessionsForTest)}
        />
        {!walletConnectState.sessions.length ? (
          <Text style={styles.emptyText}>No active sessions</Text>
        ) : (
          walletConnectState.sessions.map(session => (
            <View key={session.topic} style={styles.sessionRow}>
              <Text style={styles.dappName}>{session.peer.name}</Text>
              <Text style={styles.mutedText} numberOfLines={1}>
                {session.peer.url || session.topic}
              </Text>
              <Text style={styles.mutedText}>
                Account:{' '}
                {session.selectedAccount?.address
                  ? ellipsisAddress(session.selectedAccount.address)
                  : 'unknown'}
              </Text>
              <Text style={styles.mutedText}>
                Chains: {session.chains.slice(0, 6).join(', ')}
                {session.chains.length > 6 ? '...' : ''}
              </Text>
              <Button
                label="Disconnect"
                disabled={busy}
                variant="danger"
                onPress={() =>
                  runAction(async () => {
                    await disconnectWalletConnectSession(session.topic);
                  })
                }
              />
            </View>
          ))
        )}
      </Section>

      <Section title="Recent Log">
        {!visibleLog.length ? (
          <Text style={styles.emptyText}>No events yet</Text>
        ) : (
          visibleLog.map(item => (
            <View key={item.id} style={styles.logRow}>
              <Text style={styles.logTitle}>
                {new Date(item.ts).toLocaleTimeString()} [{item.level}]{' '}
                {item.scope}
              </Text>
              <Text style={styles.mutedText}>{item.message}</Text>
              {item.data ? (
                <Text style={styles.logData} numberOfLines={6}>
                  {item.data}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </Section>
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  valueText: {
    color: '#192945',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  statusText: {
    color: '#5D6B82',
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4C65FF',
  },
  secondaryButton: {
    backgroundColor: '#EDF1FF',
  },
  dangerButton: {
    backgroundColor: '#E34935',
  },
  disabledButton: {
    backgroundColor: '#D4D9E3',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#4C65FF',
  },
  disabledButtonText: {
    color: '#8A94A6',
  },
  scanner: {
    alignSelf: 'center',
    width: 250,
    height: 250,
  },
  uriInput: {
    minHeight: 92,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C9D2E3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#192945',
    textAlignVertical: 'top',
    fontSize: 13,
  },
  errorText: {
    color: '#D92D20',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: '#8A94A6',
    fontSize: 13,
  },
  mutedText: {
    color: '#5D6B82',
    fontSize: 12,
    lineHeight: 17,
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
  },
  dappName: {
    color: '#192945',
    fontSize: 14,
    fontWeight: '700',
  },
  flex1: {
    flex: 1,
  },
  accountList: {
    gap: 8,
  },
  accountRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8DEE8',
    borderRadius: 8,
    padding: 10,
  },
  accountRowSelected: {
    borderColor: '#4C65FF',
    backgroundColor: '#F3F6FF',
  },
  accountName: {
    color: '#192945',
    fontSize: 13,
    fontWeight: '700',
  },
  sessionRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8DEE8',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  logRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6EAF2',
    paddingTop: 8,
    gap: 3,
  },
  logTitle: {
    color: '#192945',
    fontSize: 12,
    fontWeight: '700',
  },
  logData: {
    color: '#3B4658',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Courier',
  },
});
