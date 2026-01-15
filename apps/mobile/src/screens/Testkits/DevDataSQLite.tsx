import { useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AnimateableText from 'react-native-animateable-text';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useSQLiteInfo } from '@/core/databases/hooks';
import { Button } from '@/components2024/Button';
import { useAssetsBasicInfo } from '@/databases/hooks/assets';
import { batchQueryTokensWithLocalCache } from '../Home/utils/token';
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
import { AddressItemShadowView } from '../Address/components/AddressItemShadowView';
import { touchedFeedback } from '@/utils/touch';

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
  const { styles, colors2024 } = useTheme2024({
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

function DevSQLiteInfo() {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const { sqliteInfo } = useSQLiteInfo({ enableAutoFetch: true });

  return (
    <View style={styles.showCaseRowsContainer}>
      <Text style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
        SQLite information
      </Text>
      <View
        style={[styles.propertyDesc, { marginVertical: 12, flexWrap: 'wrap' }]}>
        <View style={styles.propertyView}>
          <Text>
            version: {sqliteInfo?.version || '-'}
            {' '.repeat(100)}
          </Text>
        </View>

        <View style={[styles.propertyView]}>
          <Text style={{ width: '100%' }}>
            source_id: {sqliteInfo?.source_id || '-'}
            {' '.repeat(50)}
          </Text>
        </View>

        <View style={styles.propertyView}>
          <Text>
            thread_safe:{' '}
            {typeof sqliteInfo?.thread_safe === 'boolean'
              ? sqliteInfo?.thread_safe + ''
              : '-'}
            {' '.repeat(100)}
          </Text>
        </View>
      </View>

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
        <Text style={[styles.subMarkedTitle]}>
          Table tokenitem{' '.repeat(100)}
        </Text>
        <Text style={{ marginTop: 8 }}>
          Current Address: {currentAccount?.address || '-'} {' '.repeat(50)}
        </Text>
        <View style={styles.propertyView}>
          <Text style={{ marginTop: 8 }}>
            uniq id on tokenitem table:{' '}
            {assetsInfo.uniqueChainAddressCount || 0} {' '.repeat(100)}
          </Text>
        </View>
        <View style={styles.propertyView}>
          <Text style={{ marginTop: 8 }}>
            Total records: {assetsInfo.totalRecords || 0} {' '.repeat(100)}
          </Text>
        </View>
      </View>
      <Button
        title={'Sync Tokens'}
        height={48}
        containerStyle={[styles.rowWrapper, { marginTop: 12 }]}
        onPress={() => {
          currentAccount?.address &&
            batchQueryTokensWithLocalCache({
              user_id: currentAccount?.address,
            });
        }}
      />
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
  const { styles, colors2024, colors } = useTheme2024({
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
        <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
          <Text style={[styles.subMarkedTitle]}>Summary{' '.repeat(100)}</Text>
          <Text style={{ marginBottom: 12 }}>
            This screen shows the basic capability for high-performance Data
            Workflow, which is based on the SQLite database.
          </Text>
        </Text>
        <DevSQLiteInfo />

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

    openedDappRecord: {
      borderBottomColor: ctx.colors2024['neutral-line'],
      borderBottomWidth: 1,
    },
  };
});

export default DevDataSQLite;
