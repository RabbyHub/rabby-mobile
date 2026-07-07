import {
  Alert,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMemo } from 'react';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useSQLiteInfo } from '@/core/databases/hooks';
import { Button } from '@/components2024/Button';
import { useAssetsBasicInfo } from '@/databases/hooks/assets';
import { preferenceService } from '@/core/services';
import { makeNoop } from '../Settings/sheetModals/testDevUtils';
import { resetUpdateHistoryTime } from '@/hooks/historyTokenDict';
import {
  dropAppDataSourceAndQuitApp,
  prepareAppDataSource,
} from '@/databases/imports';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { BuyItemEntity } from '@/databases/entities/buyItem';
import {
  NEWLY_ADDED_ACCOUNT_DURATION,
  useDevNewlyAddedAccounts,
} from '@/hooks/account';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { useRestCountDownLabel } from '@/hooks/system/time';
import { accountEvents } from '@/core/apis/account';
import { AddressItemContextMenuDev } from '../Address/components/AddressItemContextMenuDev';
import { touchedFeedback } from '@/utils/touch';
import { ALL_ORM_ENTITIES } from '@/databases/entities';
import Clipboard from '@react-native-clipboard/clipboard';
import { Text, AnimateableText } from '@/components/Typography';
import RNHelpers from '@/core/native/RNHelpers';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import {
  clearSyncSchedulerRecentTasks,
  pauseSyncScheduler,
  resumeSyncScheduler,
  setSyncSchedulerCriticalMode,
  type SyncTaskSnapshot,
  useSyncSchedulerSnapshot,
} from '@/databases/sync/scheduler';
import { useToggleShowDbSyncSummaryPanel } from '../Settings/components/FloatingDbSyncSummaryPanel';

function UpdatedTimeCount({ updatedAt }: { updatedAt: number }) {
  const { countdownTextStyles, countdownTextProps } = useRestCountDownLabel({
    FUTURE_TIME: updatedAt + NEWLY_ADDED_ACCOUNT_DURATION,
    defaultText: 'Just now',
  });
  // const textRef = useRef<Text>(null);

  return (
    <AnimateableText
      // ref={textRef}
      animatedProps={countdownTextProps}
      style={[countdownTextStyles]}
    />
  );
}

function NewlyAddedAccountItem({
  item,
}: {
  item: ReturnType<typeof useDevNewlyAddedAccounts>['newlyAddedAccounts'][0];
}) {
  const { colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <AddressItem account={item}>
      {({
        WalletIcon,
        WalletName,
        WalletBalance,
        WalletAddress,
        styles: addressItemStyles,
      }) => {
        return (
          <View
            style={[
              addressItemStyles.root,
              {
                width: '100%',
                height: 64,
                borderWidth: 1,
                borderColor: colors2024['neutral-line'],
                borderRadius: 12,
                paddingHorizontal: 8,
              },
            ]}>
            <View style={addressItemStyles.leftContainer}>
              <WalletIcon
                borderRadius={12}
                address={item.address}
                width={addressItemStyles.walletIcon.width}
                height={addressItemStyles.walletIcon.height}
              />
              <View style={addressItemStyles.middle}>
                <WalletName />
                <WalletAddress />
              </View>
            </View>
            <View
              style={[
                addressItemStyles.rightContainer,
                { gap: 8, alignItems: 'flex-end' },
              ]}>
              <WalletBalance />
              <UpdatedTimeCount updatedAt={item.updated_at} />
            </View>
          </View>
        );
      }}
    </AddressItem>
  );
}

function DevORMEntities() {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <View style={styles.showCaseRowsContainer}>
      <Text style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
        ORM Entities information
      </Text>
      <View
        style={[styles.propertyDesc, { marginVertical: 12, flexWrap: 'wrap' }]}>
        {Object.entries(ALL_ORM_ENTITIES).map(([entityName, entityCls]) => {
          if ('stmSql' in entityCls === false) return null;

          const stmSql = (entityCls as any).stmSql;
          if (!stmSql) return null;

          return (
            <View
              key={entityName}
              style={[
                styles.propertyView,
                { width: '100%', flexWrap: 'nowrap', marginBottom: 8 },
              ]}>
              <Text style={{ width: '100%' }}>{entityName} stmSql: </Text>
              <Text numberOfLines={3} style={{ fontWeight: '500' }}>
                {stmSql}
              </Text>
              <Button
                title="View SQL"
                type="primary"
                height={36}
                containerStyle={[{ marginTop: 12 }]}
                onPress={() => {
                  Alert.alert(`stmSql for ${entityName}`, stmSql, [
                    { text: 'Cancel', onPress: makeNoop },
                    {
                      text: 'Copy',
                      style: 'destructive',
                      onPress: async () => {
                        Clipboard.setString(stmSql);
                      },
                    },
                  ]);
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function stringifyInfoValue(value: unknown) {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (value === null || typeof value === 'undefined' || value === '') {
    return '-';
  }

  return String(value);
}

function DevSQLiteInfoItem({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <View style={{ width: '100%', marginBottom: 8 }}>
      <Text style={{ width: '100%' }}>
        {label}: {stringifyInfoValue(value)}
        {' '.repeat(100)}
      </Text>
    </View>
  );
}

function DevSQLiteInfo() {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const { sqliteInfo, getSqliteInfo, isLoading } = useSQLiteInfo({
    enableAutoFetch: true,
  });

  return (
    <View style={styles.showCaseRowsContainer}>
      <Text style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
        SQLite information
      </Text>
      <View
        style={[styles.propertyDesc, { marginVertical: 12, flexWrap: 'wrap' }]}>
        <Text style={[styles.subMarkedTitle, { marginBottom: 12 }]}>
          Runtime
        </Text>
        <DevSQLiteInfoItem label="version" value={sqliteInfo?.version} />
        <DevSQLiteInfoItem label="source_id" value={sqliteInfo?.source_id} />
        <DevSQLiteInfoItem
          label="thread_safe"
          value={sqliteInfo?.thread_safe}
        />
        <DevSQLiteInfoItem
          label="temp_store"
          value={
            typeof sqliteInfo?.temp_store === 'number'
              ? `${sqliteInfo.temp_store} (${sqliteInfo.temp_store_label})`
              : null
          }
        />
        <DevSQLiteInfoItem
          label="test_db_path"
          value={sqliteInfo?.test_db_path}
        />

        <Text style={[styles.subMarkedTitle, { marginBottom: 12 }]}>
          Compile options
        </Text>
        <DevSQLiteInfoItem
          label="OMIT_DEPRECATED"
          value={sqliteInfo?.compile_options?.omit_deprecated}
        />
        <DevSQLiteInfoItem
          label="TEMP_STORE=2"
          value={sqliteInfo?.compile_options?.temp_store_2}
        />
        <DevSQLiteInfoItem
          label="TEMP_STORE=3"
          value={sqliteInfo?.compile_options?.temp_store_3}
        />

        <Text style={[styles.subMarkedTitle, { marginBottom: 12 }]}>
          Runtime policy
        </Text>
        <DevSQLiteInfoItem
          label="target_temp_store"
          value={sqliteInfo?.runtime_policy?.targetTempStore}
        />
        <DevSQLiteInfoItem
          label="apply_memory_pragma"
          value={sqliteInfo?.runtime_policy?.shouldApplyMemoryPragma}
        />
        <DevSQLiteInfoItem
          label="policy_reason"
          value={sqliteInfo?.runtime_policy?.reason}
        />
        <DevSQLiteInfoItem
          label="platform"
          value={sqliteInfo?.runtime_policy?.platform}
        />
        <DevSQLiteInfoItem
          label="android_api_level"
          value={sqliteInfo?.runtime_policy?.androidApiLevel}
        />
        <DevSQLiteInfoItem
          label="system_version"
          value={sqliteInfo?.runtime_policy?.systemVersion}
        />
        <DevSQLiteInfoItem
          label="manufacturer"
          value={sqliteInfo?.runtime_policy?.manufacturer}
        />
        <DevSQLiteInfoItem
          label="model"
          value={sqliteInfo?.runtime_policy?.model}
        />
        <DevSQLiteInfoItem
          label="device_id"
          value={sqliteInfo?.runtime_policy?.deviceId}
        />
        <DevSQLiteInfoItem
          label="app_db_directory"
          value={sqliteInfo?.runtime_policy?.appDbDirectory}
        />
        <DevSQLiteInfoItem
          label="candidate_temp_directory"
          value={sqliteInfo?.runtime_policy?.candidateTempDirectory}
        />

        {Platform.OS === 'android' && (
          <>
            <Text style={[styles.subMarkedTitle, { marginBottom: 12 }]}>
              Android disk probe
            </Text>
            <DevSQLiteInfoItem
              label="fs_total_space"
              value={sqliteInfo?.android_disk_probe?.fsInfo?.totalSpace}
            />
            <DevSQLiteInfoItem
              label="fs_free_space"
              value={sqliteInfo?.android_disk_probe?.fsInfo?.freeSpace}
            />
            {sqliteInfo?.android_disk_probe?.probes?.map(probe => {
              return (
                <View
                  key={`${probe.label}-${probe.path || 'null'}`}
                  style={[
                    styles.propertyView,
                    {
                      width: '100%',
                      marginBottom: 12,
                    },
                  ]}>
                  <Text style={{ width: '100%', fontWeight: '700' }}>
                    {probe.label}
                  </Text>
                  <Text style={{ width: '100%' }}>
                    path: {stringifyInfoValue(probe.path)}
                    {' '.repeat(100)}
                  </Text>
                  <Text style={{ width: '100%' }}>
                    exists: {stringifyInfoValue(probe.exists)}
                    {' '.repeat(100)}
                  </Text>
                  <Text style={{ width: '100%' }}>
                    can_write: {stringifyInfoValue(probe.canWrite)}
                    {' '.repeat(100)}
                  </Text>
                  <Text style={{ width: '100%' }}>
                    bytes_written: {stringifyInfoValue(probe.bytesWritten)}
                    {' '.repeat(100)}
                  </Text>
                  <Text style={{ width: '100%' }}>
                    error: {stringifyInfoValue(probe.error)}
                    {' '.repeat(100)}
                  </Text>
                </View>
              );
            })}
          </>
        )}
      </View>

      <Button
        title={isLoading ? 'Refreshing SQLite info...' : 'Refresh SQLite info'}
        height={48}
        containerStyle={[styles.rowWrapper, { marginBottom: 12 }]}
        onPress={() => getSqliteInfo()}
      />

      <Button
        title={'Force Exit App'}
        type="danger"
        height={48}
        containerStyle={[styles.rowWrapper, { marginVertical: 12 }]}
        onPress={() => {
          RNHelpers.forceExitApp();
        }}
      />

      <Button
        title={'Clear All SQLite and quit'}
        type="danger"
        height={48}
        containerStyle={[styles.rowWrapper, { marginTop: 12 }]}
        onPress={() => {
          Alert.alert(
            'Clear',
            'This will clear all SQLite database data, restart app is required, are you sure?',
            [
              { text: 'Cancel', onPress: makeNoop },
              {
                text: 'Clear',
                style: 'destructive',
                onPress: async () => {
                  resetUpdateHistoryTime();
                  await dropAppDataSourceAndQuitApp();
                },
              },
            ],
          );
        }}
      />
    </View>
  );
}

function formatMs(value?: number) {
  if (typeof value !== 'number') {
    return '-';
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${value}ms`;
}

function shortenOwner(owner: string) {
  if (!owner) {
    return '-';
  }

  if (owner.length <= 16) {
    return owner;
  }

  return `${owner.slice(0, 8)}...${owner.slice(-6)}`;
}

function DevSyncTaskInfoRow({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <View style={styles.schedulerInfoRow}>
      <Text style={styles.schedulerInfoLabel}>{label}</Text>
      <Text
        numberOfLines={2}
        ellipsizeMode="middle"
        style={styles.schedulerInfoValue}>
        {stringifyInfoValue(value)}
      </Text>
    </View>
  );
}

function DevSyncTaskCard({ task }: { task: SyncTaskSnapshot }) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const statusColor =
    task.status === 'error' || task.status === 'aborted'
      ? colors2024['red-default']
      : task.status === 'success'
      ? colors2024['green-default']
      : colors2024['blue-default'];
  const duration =
    task.durationMs ??
    (task.startedAt
      ? Date.now() - task.startedAt
      : Date.now() - task.createdAt);

  return (
    <View style={styles.schedulerTaskCard}>
      <View style={styles.schedulerTaskHeader}>
        <Text numberOfLines={1} style={styles.schedulerTaskTitle}>
          {task.taskFor} / {task.entityName}
        </Text>
        <Text style={[styles.schedulerTaskStatus, { color: statusColor }]}>
          {task.status}
        </Text>
      </View>

      <View style={styles.schedulerTaskBody}>
        <DevSyncTaskInfoRow label="owner" value={shortenOwner(task.owner)} />
        <DevSyncTaskInfoRow label="priority" value={task.priority} />
        <DevSyncTaskInfoRow
          label="rows"
          value={`${task.rowCount} rows / ${task.completedBatches}/${task.totalBatches} batches`}
        />
        <DevSyncTaskInfoRow label="batch size" value={task.batchSize} />
        <DevSyncTaskInfoRow label="method" value={task.method || '-'} />
        <DevSyncTaskInfoRow label="stage" value={task.stage} />
        <DevSyncTaskInfoRow label="duration" value={formatMs(duration)} />
        {task.lastBatch && (
          <DevSyncTaskInfoRow
            label="last batch"
            value={`#${task.lastBatch.round + 1}, ${
              task.lastBatch.count
            } rows, ${formatMs(task.lastBatch.durationMs)}`}
          />
        )}
        {task.lastError && (
          <DevSyncTaskInfoRow label="error" value={task.lastError} />
        )}
      </View>
    </View>
  );
}

function DevDbSyncSummaryToggleRow() {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const { showDbSyncSummaryPanel, toggleShowDbSyncSummaryPanel } =
    useToggleShowDbSyncSummaryPanel();

  return (
    <View style={styles.schedulerInfoRow}>
      <View style={styles.schedulerToggleText}>
        <Text style={styles.schedulerToggleTitle}>Floating summary</Text>
        <Text style={styles.schedulerToggleDesc}>
          Persisted overlay for startup DB sync tasks
        </Text>
      </View>
      <AppSwitch2024
        circleSize={20}
        value={!!showDbSyncSummaryPanel}
        changeValueImmediately={false}
        onValueChange={nextEnabled => {
          toggleShowDbSyncSummaryPanel(nextEnabled);
        }}
        backgroundActive={colors2024['green-default']}
        circleBorderActiveColor={colors2024['green-default']}
      />
    </View>
  );
}

function DevSyncTaskPanel() {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const snapshot = useSyncSchedulerSnapshot();
  const liveTasks = snapshot.tasks;
  const recentTasks = useMemo(
    () => snapshot.recentTasks.slice(0, 12),
    [snapshot.recentTasks],
  );
  const isManuallyPaused = snapshot.pauseReasons.includes('dev-panel');
  const isDevCritical = snapshot.criticalReasons.includes('dev-panel-critical');

  return (
    <View style={styles.showCaseRowsContainer}>
      <Text style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
        SQLite / Sync task queue
      </Text>

      <View style={styles.schedulerSummaryGrid}>
        <DevDbSyncSummaryToggleRow />
        <DevSyncTaskInfoRow label="active" value={snapshot.activeCount} />
        <DevSyncTaskInfoRow label="queued" value={snapshot.queuedCount} />
        <DevSyncTaskInfoRow label="recent" value={snapshot.recentCount} />
        <DevSyncTaskInfoRow
          label="pause"
          value={snapshot.pauseReasons.join(', ') || '-'}
        />
        <DevSyncTaskInfoRow
          label="critical"
          value={snapshot.criticalReasons.join(', ') || '-'}
        />
      </View>

      <View style={styles.schedulerActions}>
        <Button
          title={isManuallyPaused ? 'Resume Sync' : 'Pause Sync'}
          height={40}
          containerStyle={styles.schedulerActionButton}
          onPress={() => {
            if (isManuallyPaused) {
              resumeSyncScheduler('dev-panel');
            } else {
              pauseSyncScheduler('dev-panel');
            }
          }}
        />
        <Button
          title={isDevCritical ? 'End Critical' : 'Start Critical'}
          height={40}
          containerStyle={styles.schedulerActionButton}
          onPress={() => {
            setSyncSchedulerCriticalMode(!isDevCritical, 'dev-panel-critical');
          }}
        />
        <Button
          title="Clear Recent"
          height={40}
          containerStyle={styles.schedulerActionButton}
          onPress={clearSyncSchedulerRecentTasks}
        />
      </View>

      <Text style={[styles.subMarkedTitle, { marginTop: 12, marginBottom: 8 }]}>
        Live tasks
      </Text>
      {liveTasks.length ? (
        liveTasks.map(task => <DevSyncTaskCard key={task.id} task={task} />)
      ) : (
        <Text style={styles.schedulerEmptyText}>No live sync task</Text>
      )}

      <Text style={[styles.subMarkedTitle, { marginTop: 12, marginBottom: 8 }]}>
        Recent tasks
      </Text>
      {recentTasks.length ? (
        recentTasks.map(task => <DevSyncTaskCard key={task.id} task={task} />)
      ) : (
        <Text style={styles.schedulerEmptyText}>No recent sync task</Text>
      )}
    </View>
  );
}

function DevDataAccount() {
  const { styles } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const currentAccount = preferenceService.getFallbackAccount();
  const { assetsInfo, fetchAssetsInfo } = useAssetsBasicInfo({
    enableAutoFetch: true,
  });

  const { newlyAddedAccounts } = useDevNewlyAddedAccounts();

  return (
    <View style={[styles.showCaseRowsContainer]}>
      <Text style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
        Account's data
      </Text>
      <View style={[styles.propertyDesc, { marginTop: 12 }]}>
        <Text style={[styles.subMarkedTitle]}>Table tokenitem</Text>
        <Text style={{ marginTop: 8 }}>
          Current Address: {currentAccount?.address || '-'}
        </Text>
        <View style={styles.propertyView}>
          <Text style={{ marginTop: 8 }}>
            uniq id on tokenitem table:{' '}
            {assetsInfo.uniqueChainAddressCount || 0}
          </Text>
        </View>
        <View style={styles.propertyView}>
          <Text style={{ marginTop: 8 }}>
            Total records: {assetsInfo.totalRecords || 0}
          </Text>
        </View>
      </View>
      <Button
        title={'Fetch Assets Info'}
        height={48}
        containerStyle={[styles.rowWrapper, { marginTop: 12 }]}
        onPress={() => fetchAssetsInfo()}
      />

      <View style={{ marginTop: 24, width: '100%' }}>
        <Text style={[styles.subMarkedTitle, { marginBottom: 12 }]}>
          Newly Added Accounts Total: {newlyAddedAccounts.length}
        </Text>
        <FlatList
          data={newlyAddedAccounts}
          contentContainerStyle={{ gap: 8 }}
          renderItem={info => {
            const { item } = info;
            return (
              <AddressItemContextMenuDev
                key={item._db_id}
                account={item}
                actions={['dev:removeAddedRecord']}>
                <TouchableOpacity
                  activeOpacity={1}
                  // onPressIn={() => !useLongPressing && setIsPressing(true)}
                  // onPressOut={() => setIsPressing(false)}
                  // style={StyleSheet.flatten([styles.root])}
                  delayLongPress={200} // long press delay
                  // onPress={onDetail}
                  onLongPress={() => {
                    // useLongPressing && setIsPressing(true);
                    touchedFeedback();
                  }}>
                  <NewlyAddedAccountItem item={item} />
                </TouchableOpacity>
              </AddressItemContextMenuDev>
            );
          }}
        />
      </View>

      {!newlyAddedAccounts.length && (
        <Button
          title={'Mock Current Account Added'}
          height={48}
          containerStyle={[styles.rowWrapper, { marginTop: 12 }]}
          onPress={() => {
            if (!currentAccount) return;

            accountEvents.emit('ACCOUNT_ADDED', {
              accounts: [currentAccount],
            });
          }}
        />
      )}
    </View>
  );
}

function DevDataSQLite() {
  const { styles, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <NormalScreenContainer
      noHeader
      style={styles.screen}
      overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled={true}
        contentContainerStyle={[styles.screenScrollableView]}
        horizontal={false}>
        <Text style={styles.areaTitle}>SQLite</Text>
        <View style={[styles.propertyDesc, { marginVertical: 12, gap: 8 }]}>
          <Text style={styles.subMarkedTitle}>Summary</Text>
          <Text style={{ marginBottom: 12 }}>
            This screen shows the basic capability for high-performance Data
            Workflow, which is based on the SQLite database.
          </Text>
        </View>
        <DevSQLiteInfo />

        <DevSyncTaskPanel />

        <DevDataAccount />

        <View style={[styles.showCaseRowsContainer]}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            History's data
          </Text>

          <Button
            title={'Clear history DB data'}
            type="danger"
            height={48}
            containerStyle={[styles.rowWrapper, { marginTop: 12 }]}
            onPress={async () => {
              resetUpdateHistoryTime();
              await prepareAppDataSource();
              await Promise.all([
                HistoryItemEntity.clear(),
                BuyItemEntity.clear(),
              ]);
            }}
          />
        </View>

        <DevORMEntities />
      </ScrollView>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => {
  const CONTENT_W = Dimensions.get('screen').width - 24;
  return {
    screen: {
      backgroundColor: 'black',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
    },
    areaTitle: {
      fontSize: 36,
      marginBottom: 12,
      color: ctx.colors2024['neutral-title-1'],
    },
    screenScrollableView: {
      minHeight: '100%',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      // marginTop: 12,
      paddingHorizontal: 12,
      paddingBottom: 64,
      // ...makeDebugBorder(),
    },
    showCaseRowsContainer: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',

      paddingTop: 16,
      paddingBottom: 12,
      borderTopWidth: 2,
      borderStyle: 'dotted',
      borderTopColor: ctx.colors2024['neutral-foot'],
    },
    componentName: {
      color: ctx.colors2024['blue-default'],
      textAlign: 'left',
      fontSize: 24,
    },
    rowWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: '100%',
    },
    rowFieldLabel: {
      fontSize: 16,
      color: ctx.colors2024['neutral-title-1'],
    },
    label: {
      fontSize: 16,
      color: ctx.colors2024['neutral-title-1'],
    },
    labelIcon: { width: 24, height: 24 },
    propertyView: {
      marginBottom: 8,
      maxWidth: '100%',
      flexWrap: 'wrap',
    },
    propertyDesc: {
      flexDirection: 'row',
      width: '100%',
      maxWidth: CONTENT_W,
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    propertyType: {
      color: ctx.colors2024['blue-default'],
      fontSize: 16,
    },
    subMarkedTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    schedulerSummaryGrid: {
      width: '100%',
      maxWidth: CONTENT_W,
      flexDirection: 'column',
      gap: 8,
      marginBottom: 12,
    },
    schedulerInfoRow: {
      width: '100%',
      minHeight: 36,
      borderRadius: 8,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    schedulerInfoLabel: {
      width: 96,
      flexShrink: 0,
      fontSize: 13,
      color: ctx.colors2024['neutral-secondary'],
    },
    schedulerInfoValue: {
      flex: 1,
      minWidth: 0,
      textAlign: 'right',
      fontSize: 13,
      fontWeight: '600',
      color: ctx.colors2024['neutral-title-1'],
    },
    schedulerToggleText: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'column',
      gap: 2,
    },
    schedulerToggleTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    schedulerToggleDesc: {
      fontSize: 12,
      color: ctx.colors2024['neutral-secondary'],
    },
    schedulerActions: {
      width: '100%',
      maxWidth: CONTENT_W,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    schedulerActionButton: {
      minWidth: 128,
      flexGrow: 1,
    },
    schedulerTaskCard: {
      width: '100%',
      maxWidth: CONTENT_W,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: ctx.colors2024['neutral-line'],
      padding: 12,
      marginBottom: 10,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      gap: 8,
    },
    schedulerTaskHeader: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    schedulerTaskTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: 16,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
    },
    schedulerTaskStatus: {
      flexShrink: 0,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    schedulerTaskBody: {
      width: '100%',
      flexDirection: 'column',
      gap: 6,
    },
    schedulerEmptyText: {
      fontSize: 14,
      color: ctx.colors2024['neutral-secondary'],
      marginBottom: 8,
    },

    openedDappRecord: {
      borderBottomColor: ctx.colors2024['neutral-line'],
      borderBottomWidth: 1,
    },
  };
});

export default DevDataSQLite;
