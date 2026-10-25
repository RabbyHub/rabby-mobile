import React, { useCallback, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Slider } from '@rneui/themed';
import {
  RootScenePager,
  RootScenePagerGestureBlock,
  type RootScenePageContext,
} from '@rabby-wallet/rn-collapsible-scene-view';
import { Text, TextInput } from '@/components/Typography';

const PAGE_KEYS = ['Swap', 'Bridge'] as const;
const ROWS = Array.from({ length: 14 }, (_, index) => index + 1);

const FixturePage = React.memo(function FixturePage({
  pageKey,
  interactive,
  selected,
  visible,
}: RootScenePageContext & { pageKey: string }) {
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState(25);
  const [offset, setOffset] = useState(0);
  const recordOffset = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setOffset(Math.round(event.nativeEvent.contentOffset.y));
    },
    [],
  );

  return (
    <View
      style={[styles.page, pageKey === 'Swap' ? styles.swap : styles.bridge]}>
      <Text style={styles.pageTitle}>{pageKey}</Text>
      <Text testID={`root-fixture-state-${pageKey}`} style={styles.state}>
        selected={String(selected)} visible={String(visible)} y={offset}
      </Text>
      <ScrollView
        testID={`root-fixture-scroll-${pageKey}`}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        scrollEnabled={interactive}
        onScrollEndDrag={recordOffset}
        onMomentumScrollEnd={recordOffset}>
        <RootScenePagerGestureBlock
          testID={`root-fixture-input-block-${pageKey}`}>
          <TextInput
            testID={`root-fixture-input-${pageKey}`}
            accessibilityLabel={`${pageKey} amount`}
            editable={interactive}
            keyboardType="decimal-pad"
            placeholder="Amount"
            placeholderTextColor="#777"
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
          />
        </RootScenePagerGestureBlock>
        <RootScenePagerGestureBlock
          testID={`root-fixture-slider-block-${pageKey}`}
          accessibilityLabel={`${pageKey} percentage`}
          style={styles.sliderBlock}>
          <Text testID={`root-fixture-percentage-${pageKey}`}>
            Amount: {percentage}%
          </Text>
          <Slider
            allowTouchTrack={interactive}
            disabled={!interactive}
            value={percentage}
            onValueChange={setPercentage}
            minimumValue={0}
            maximumValue={100}
            step={1}
            minimumTrackTintColor="#596dff"
            maximumTrackTintColor="#c7cbd4"
            thumbStyle={styles.thumb}
          />
        </RootScenePagerGestureBlock>
        <View testID={`root-fixture-blank-${pageKey}`} style={styles.blank}>
          <Text style={styles.state}>Swipe space</Text>
        </View>
        {ROWS.map(row => (
          <View key={row} style={styles.row}>
            <Text>
              {pageKey} row {row}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

/** Two retained full screens; each ScrollView owns its own native Y offset. */
export default function DevUIRootSubScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [requestedKey, setRequestedKey] = useState('Swap');
  const [settledKey, setSettledKey] = useState('Swap');
  const onSettled = useCallback((key: string) => {
    setSettledKey(key);
    setRequestedKey(key);
  }, []);
  const renderPage = useCallback(
    (key: string, context: RootScenePageContext) => (
      <FixturePage pageKey={key} {...context} />
    ),
    [],
  );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.button}>
          <Text>Back</Text>
        </Pressable>
        {PAGE_KEYS.map(key => (
          <Pressable
            key={key}
            testID={`root-fixture-select-${key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: settledKey === key }}
            onPress={() => {
              Keyboard.dismiss();
              setRequestedKey(key);
            }}
            style={[
              styles.button,
              settledKey === key && styles.selectedButton,
            ]}>
            <Text>{key}</Text>
          </Pressable>
        ))}
      </View>
      <Text testID="root-fixture-status" style={styles.status}>
        Root · requested={requestedKey} settled={settledKey}
      </Text>
      <RootScenePager
        keys={PAGE_KEYS}
        requestedKey={requestedKey}
        onSettled={onSettled}
        renderPage={renderPage}
        testID="root-fixture"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  toolbar: { flexDirection: 'row', padding: 8, gap: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  selectedButton: { backgroundColor: '#dbe7ff' },
  status: { paddingHorizontal: 16, paddingBottom: 12, fontSize: 12 },
  page: { flex: 1, paddingTop: 16 },
  swap: { backgroundColor: '#eff3ff' },
  bridge: { backgroundColor: '#eff8f2' },
  pageTitle: { fontSize: 20, paddingHorizontal: 16 },
  state: { color: '#52606d', fontSize: 12 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  input: {
    borderWidth: 1,
    borderColor: '#a5aebd',
    borderRadius: 8,
    color: '#1b2430',
    padding: 12,
    height: 48,
  },
  sliderBlock: { marginTop: 16, paddingVertical: 12 },
  thumb: { width: 20, height: 20, backgroundColor: '#596dff' },
  blank: { height: 160, alignItems: 'center', justifyContent: 'center' },
  row: {
    height: 72,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c7cbd4',
  },
});
