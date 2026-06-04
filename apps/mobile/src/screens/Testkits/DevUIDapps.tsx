import React from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import {
  useDappsViewConfig,
  useOpenDappView,
  useOpenedActiveDappState,
  useOpenedDappsRecordsOnDEV,
} from '../Dapps/hooks/useDappView';
import { Button } from '@/components2024/Button';
import { formatTimeReadable } from '@/utils/time';
import dayjs from 'dayjs';
import { urlUtils } from '@rabby-wallet/base-utils';
import { Text } from '@/components/Typography';
import {
  DAPP_SIGN_AUTH_SESSION_INTERVAL_MS_PROD,
  useDappSignAuthSessionIntervalMs,
} from '@/hooks/appSettings';

const TEST_OPEN_DAPPS = [
  'https://debank.com',
  'https://app.uniswap.org',
  'https://app.1inch.io',
  'https://metamask.github.io/test-dapp',
];

function DevUIDapps() {
  const { styles, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  const { dappsViewConfig } = useDappsViewConfig();
  const {
    dappSignAuthSessionIntervalMs,
    canSwitchDappSignAuthSessionInterval,
    dappSignAuthSessionIntervalOptions,
    setDappSignAuthSessionIntervalMs,
  } = useDappSignAuthSessionIntervalMs();

  const {} = useOpenedActiveDappState();
  const { openedDappRecords } = useOpenedDappsRecordsOnDEV();
  const { openUrlAsDapp } = useOpenDappView();

  return (
    <NormalScreenContainer
      noHeader
      style={styles.screen}
      overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled={true}
        contentContainerStyle={[styles.screenScrollableView]}
        horizontal={false}>
        <Text style={styles.areaTitle}>Dapps</Text>
        <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
          <Text style={[{ fontSize: 18, fontWeight: '700' }]}>
            Summary{' '.repeat(100)}
          </Text>
          <Text style={{ marginBottom: 12 }}>
            NormalScreenContainer is a commonly used screen type that features a
            simple vertical layout. In most cases, you can safely place your
            main content within it.
          </Text>
        </Text>
        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            Dapp WebView Limitations
          </Text>
          <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
            <Text style={{ marginBottom: 12 }}>
              Max open dapps: {dappsViewConfig.maxCount}
              {' '.repeat(100)}
            </Text>
            <Text style={{ marginBottom: 12 }}>
              Open Dapp expire duration: {dappsViewConfig.expireDuration} ms
            </Text>
          </Text>
        </View>
        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            Dapp Signing Auth Session
          </Text>
          <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
            <Text style={{ marginBottom: 12 }}>
              Current auth-free duration:{' '}
              {formatTimeReadable(dappSignAuthSessionIntervalMs / 1000)}
              {' '.repeat(100)}
            </Text>
            <Text style={{ marginBottom: 12 }}>
              Non-production packages can override this value. Production
              packages always use{' '}
              {formatTimeReadable(
                DAPP_SIGN_AUTH_SESSION_INTERVAL_MS_PROD / 1000,
              )}
              .
            </Text>
          </Text>
          <View style={styles.durationOptionList}>
            {dappSignAuthSessionIntervalOptions.map(option => {
              const selected = option.value === dappSignAuthSessionIntervalMs;

              return (
                <Button
                  key={option.value}
                  title={option.label}
                  type={selected ? 'primary' : 'ghost'}
                  height={40}
                  disabled={!canSwitchDappSignAuthSessionInterval}
                  containerStyle={styles.durationOptionButton}
                  onPress={() => {
                    setDappSignAuthSessionIntervalMs(option.value);
                  }}
                />
              );
            })}
          </View>
        </View>
        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            Opened Dapps: {openedDappRecords.length}
          </Text>
          {openedDappRecords.map((record, index) => {
            const key = `${record.origin}-${record.dappTabId}-${record.openTime}-${index}`;

            return (
              <View key={key} style={styles.openedDappRecord}>
                <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
                  <Text style={{ marginBottom: 12 }}>
                    Dapp Tab ID: {record.dappTabId} {' '.repeat(100)}
                  </Text>
                  <Text style={{ marginBottom: 12 }}>
                    Open ID/Origin: {record.origin} {' '.repeat(100)}
                  </Text>
                  <Text style={{ marginBottom: 12 }}>
                    Open Last WebView ID: {record.lastOpenWebViewId || '-'}{' '}
                    {' '.repeat(100)}
                  </Text>
                  <Text style={{ marginBottom: 12 }}>
                    Open Time:{' '}
                    {dayjs(record.openTime)
                      .format('YYYY/MM/DD HH:mm:ss')
                      .toString()}{' '}
                    {' '.repeat(100)}
                  </Text>
                </Text>
              </View>
            );
          })}
        </View>
        {TEST_OPEN_DAPPS.map((url, index) => {
          const key = `${url}-${index}`;
          return (
            <Button
              key={key}
              containerStyle={{ marginBottom: 12 }}
              onPress={() => {
                openUrlAsDapp(url, {
                  forceReopen: true,
                  showSheetModalFirst: false,
                });
              }}
              title={`open ${urlUtils.canoicalizeDappUrl(url).hostname}`}
            />
          );
        })}
      </ScrollView>
    </NormalScreenContainer>
  );
}

const CONTENT_W = Dimensions.get('screen').width - 24;
const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
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
    durationOptionList: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    durationOptionButton: {
      minWidth: 92,
    },

    openedDappRecord: {
      borderBottomColor: ctx.colors2024['neutral-line'],
      borderBottomWidth: 1,
    },
  }),
);

export default DevUIDapps;
