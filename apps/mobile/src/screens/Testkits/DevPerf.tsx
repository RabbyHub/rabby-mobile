import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import RNFS from 'react-native-fs';

import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/native';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Button } from '@/components2024/Button';
import { formatTimeReadable } from '@/utils/time';
import { workerThread } from '@/perfs/thread';
import { runDevIIFEFunc } from '@/core/utils/store';
import { toast } from '@/components2024/Toast';
import dayjs from 'dayjs';
import { zCreate } from '@/core/utils/reexports';
import { NextInput } from '@/components2024/Form/Input';
import { coerceInteger } from '@/utils/number';
import { apisLending } from '../Lending/hooks';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { worker_plus } from '@/perfs/workerReq';

export const makeNoop = () => () => {};

workerThread.addListener('@ThreadStarted', payload => {
  workerThreadState.setState({ running: true });
  toast.info(`Computation Thread started: ${payload?.tid}`);
});

workerThread.addListener('@ThreadStopped', payload => {
  workerThreadState.setState({ running: false });
  toast.info(`Computation Thread stopped: ${payload?.tid}`);
});

const workerThreadState = zCreate<{ running: boolean }>(() => ({
  running: workerThread.isRunning,
}));

function DevWorker() {
  const ACK_LIMIT = 5;
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const threadRunning = workerThreadState(s => s.running);
  const [ackMsgs, setAckMsgs] = useState<WorkerSendDict['ack'][]>([]);
  const sortedAckMsgs = useMemo(() => {
    return ackMsgs.slice(0, ACK_LIMIT).sort((a, b) => b.time - a.time);
  }, [ackMsgs]);

  const [plusData, setPlusData] = useState<{
    leftValue: number | string;
    rightValue: number | string;
  }>({
    leftValue: 1,
    rightValue: 2,
  });

  useEffect(() => {
    const subscription = workerThread.onThreadMessage(payload => {
      switch (payload.type) {
        case 'ack': {
          setAckMsgs(msgs => {
            const newMsgs = [...msgs, payload].slice(-ACK_LIMIT);
            return newMsgs;
          });
          break;
        }
        case '@catchedError': {
          const { isFatal, error } = payload;
          console.debug('[perf] Worker Thread Error:', payload);
          break;
        }
        default: {
          console.debug('[perf] Received payload not cared:', payload);
          break;
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.showCaseRowsContainer}>
      <View style={styles.secondarySectionHeader}>
        <Text
          style={[
            styles.secondarySectionTitle,
            { fontSize: 24, marginLeft: 2 },
          ]}>
          Worker Thread
        </Text>
      </View>

      <View
        style={[
          styles.secondarySectionContent,
          { flexDirection: 'column', width: '100%' },
        ]}>
        <Text
          style={[
            styles.secondarySectionTitle,
            { fontSize: 18, marginLeft: 2 },
          ]}>
          Basic Capacities
        </Text>
        <View
          style={{
            flexDirection: 'row',
            marginTop: 12,
            gap: 12,
            justifyContent: 'flex-start',
            alignItems: 'center',
            width: '100%',
          }}>
          <Button
            disabled={!threadRunning}
            title={'Restart'}
            type="warning"
            height={48}
            containerStyle={{ flexShrink: 1, width: '50%', marginTop: 0 }}
            onPress={() => {
              workerThread.restart();
            }}
          />
          <Button
            title={threadRunning ? 'Stop Thread' : 'Start Thread'}
            type={threadRunning ? 'danger' : 'primary'}
            height={48}
            containerStyle={{ flexShrink: 1, width: '50%', marginTop: 0 }}
            onPress={() => {
              if (threadRunning) {
                workerThread.terminate();
              } else {
                workerThread.start();
              }
            }}
          />
        </View>
        <Button
          title={
            IS_IOS
              ? `LS iOS MainBundlePath Dir List`
              : `LS Android Assets Dir List`
          }
          type="ghost"
          height={48}
          containerStyle={{ marginTop: 12, height: '100%' }}
          onPress={() => {
            if (IS_IOS) {
              RNFS.readDir(RNFS.MainBundlePath).then(res => {
                console.debug(
                  'RNFS.MainBundlePath dir list:',
                  res,
                  res.map(item => item.name),
                );
              });
            } else if (IS_ANDROID) {
              RNFS.readDir(RNFS.DocumentDirectoryPath).then(res => {
                console.debug(
                  'RNFS.DocumentDirectoryPath dir list:',
                  res,
                  res.map(item => item.name),
                );
              });
            }
          }}
        />
      </View>

      <View
        style={[
          styles.secondarySectionContent,
          { flexDirection: 'column', marginTop: 16, width: '100%' },
        ]}>
        <Text style={[styles.secondarySectionTitle, { fontSize: 18 }]}>
          Lifecycle
        </Text>
        <View style={{ marginTop: 16, width: '100%' }}>
          <Button
            title={'Trigger WorkerThread Error'}
            type="warning"
            height={48}
            containerStyle={{ height: '100%' }}
            onPress={() => {
              workerThread.remoteCall('@DevTest', {
                purpose: 'triggerError',
              });
            }}
          />
          <Button
            title={'Trigger Garbage Collection'}
            type="primary"
            height={48}
            containerStyle={{ height: '100%', marginTop: 12 }}
            onPress={() => {
              workerThread.remoteCall('@DevTest', {
                purpose: 'triggerGC',
              });
            }}
          />
        </View>
      </View>

      <View
        style={[
          styles.secondarySectionContent,
          { flexDirection: 'column', marginTop: 16, width: '100%' },
        ]}>
        <Text
          style={[
            styles.secondarySectionTitle,
            { fontSize: 18, marginLeft: 2 },
          ]}>
          Remote Call
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            width: '100%',
            // maxWidth: Dimensions.get('screen').width - 24,
          }}>
          <NextInput
            containerStyle={{ flexShrink: 1 }}
            inputProps={{
              value: plusData.leftValue + '',
              onChangeText: text => {
                const num = parseInt(text) || '';
                setPlusData(data => ({ ...data, leftValue: num }));
              },
              keyboardType: 'numeric',
              placeholder: 'Left Value',
            }}
          />
          <NextInput
            containerStyle={{ flexShrink: 1 }}
            inputProps={{
              value: plusData.rightValue + '',
              onChangeText: text => {
                const num = parseInt(text) || '';
                setPlusData(data => ({ ...data, rightValue: num }));
              },
              keyboardType: 'numeric',
              placeholder: 'Right Value',
            }}
          />
          <Button
            disabled={plusData.leftValue === '' || plusData.rightValue === ''}
            title={`= ? (RPC)`}
            type="ghost"
            height={48}
            containerStyle={{ height: '100%' }}
            style={{ width: 100 }}
            onPress={() => {
              worker_plus(
                coerceInteger(plusData.leftValue),
                coerceInteger(plusData.rightValue),
              ).then(res => {
                toast.success(`plus result: ${res}`);
              });
            }}
          />
        </View>

        <View style={{ marginTop: 12, width: '100%' }}>
          <Button
            title={`Trigger Lending Data`}
            type="ghost"
            height={48}
            containerStyle={{ height: '100%' }}
            onPress={() => {
              apisLending.fetchLendingData();
            }}
          />
        </View>
      </View>

      <View
        style={{
          marginTop: 8,
          width: '100%',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
        }}>
        <FlatList
          data={sortedAckMsgs}
          renderItem={({ item }) => {
            return (
              <View style={{ marginTop: 6 }}>
                <Text
                  style={{
                    color: colors2024['neutral-title-1'],
                    fontSize: 14,
                    marginTop: 4,
                  }}>
                  [ack] {dayjs(item.time).format('YYYY-MM-DD HH:mm:ss.SSS')}
                </Text>
              </View>
            );
          }}
          keyExtractor={(_, index) => `ack-msg-${_.time}-${index}`}
        />
      </View>
    </View>
  );
}

function DevPerf(): JSX.Element {
  const { styles, colors2024, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  const navigation = useNavigation();

  return (
    <NormalScreenContainer
      style={styles.screen}
      noHeader
      overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled={false}
        contentContainerStyle={styles.screenScrollableView}
        horizontal={false}>
        <Text style={styles.areaTitle}>High Performance</Text>
        <DevWorker />
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
    secondarySectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginBottom: 12,
    },
    secondarySectionTitle: {
      color: ctx.colors2024['blue-default'],
      textAlign: 'left',
      fontSize: 24,
    },
    secondarySectionContent: {
      flexDirection: 'column',
    },
    switchRowWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: '100%',
      gap: 4,
    },
    switchLabel: {
      fontSize: 16,
      color: ctx.colors2024['neutral-title-1'],
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
  }),
);

export default DevPerf;
