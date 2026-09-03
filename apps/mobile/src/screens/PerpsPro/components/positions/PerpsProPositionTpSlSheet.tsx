import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetScrollView,
  type BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  getPerpsProPositionTpSlFormMinimumHeight,
  getPerpsProPositionTpSlSnapPoint,
  type PerpsProPositionTpSlFormPresentation,
} from '../../model/layout';
import type { PerpsPositionViewModel } from '../../model/position';
import type {
  PerpsPositionTpSlDraft,
  PerpsPositionTpSlMarketSnapshot,
  PerpsPositionTpSlOrderViewModel,
} from '../../model/positionTpSl';
import type { PerpsProTradeAmountUnit } from '../../model/trade';
import { usePerpsProPositionMark } from '../../scene/usePerpsProPositionMark';
import { PerpsProPositionTpSlForm } from './PerpsProPositionTpSlForm';
import {
  PerpsProPositionTpSlHeader,
  PerpsProPositionTpSlPageHeader,
} from './PerpsProPositionTpSlHeader';
import { PerpsProPositionTpSlOrderList } from './PerpsProPositionTpSlOrderList';
import { getPerpsProBottomSheetChromeStyles } from '../common/perpsProVisual';
import { usePerpsProFieldExplanation } from '../common/PerpsProFieldExplanationContext';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

type PartialPage = 'add' | 'list' | 'modify';

export const PerpsProPositionTpSlSheet: React.FC<{
  amountUnit: PerpsProTradeAmountUnit;
  cancelingOids: readonly number[];
  confirmedCancelledOids: readonly number[];
  coveredByReview: boolean;
  defaultTab: 'partial' | 'position';
  market: PerpsPositionTpSlMarketSnapshot;
  onCancelOrder: (order: PerpsPositionTpSlOrderViewModel) => void;
  onClose: () => void;
  onReview: (draft: PerpsPositionTpSlDraft) => void;
  pending: boolean;
  position: PerpsPositionViewModel;
  reviewRequesting?: boolean;
  settlement?: {
    revision: number;
    scope: 'partial' | 'position';
  } | null;
  submissionPending?: boolean;
  visible: boolean;
}> = React.memo(
  ({
    amountUnit,
    cancelingOids,
    confirmedCancelledOids,
    coveredByReview,
    defaultTab,
    market,
    onCancelOrder,
    onClose,
    onReview,
    pending,
    position,
    reviewRequesting = false,
    settlement = null,
    submissionPending = false,
    visible,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const scrollViewRef = useRef<BottomSheetScrollViewMethods>(null);
    const handledSettlementRevisionRef = useRef(0);
    const keyboardSessionActiveRef = useRef(false);
    const scrollFrameRef = useRef<number | null>(null);
    const restingSheetPositionRef = useRef<number | null>(null);
    const animatedSheetPosition = useSharedValue(Number.NaN);
    const restingSheetPosition = useSharedValue(Number.NaN);
    const androidScrollAfterKeyboardRestore = useSharedValue(false);
    const { height: windowHeight } = useWindowDimensions();
    const stableWindowHeight = useRef(windowHeight).current;
    const insets = useSafeAreaInsets();
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const openFieldExplanation = usePerpsProFieldExplanation();
    const [tab, setTab] = useState<'partial' | 'position'>(defaultTab);
    const [partialPage, setPartialPage] = useState<PartialPage>('list');
    const [editingOrder, setEditingOrder] =
      useState<PerpsPositionTpSlOrderViewModel | null>(null);
    const liveMarket = usePerpsProPositionMark(position.coin);
    const interactionLocked = pending || coveredByReview || reviewRequesting;
    const positionPresentationLocked =
      submissionPending || coveredByReview || reviewRequesting;

    const returnToPartialList = useCallback(() => {
      Keyboard.dismiss();
      setEditingOrder(null);
      setPartialPage('list');
    }, []);
    const openEstimatedPnlExplanation = useCallback(
      () => openFieldExplanation('estimatedPnl'),
      [openFieldExplanation],
    );
    const requestDismiss = useCallback(() => {
      if (interactionLocked) {
        return;
      }
      if (tab === 'partial' && partialPage !== 'list') {
        returnToPartialList();
        return;
      }
      Keyboard.dismiss();
      modalRef.current?.dismiss();
    }, [interactionLocked, partialPage, returnToPartialList, tab]);
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: requestDismiss,
      dismissible: !interactionLocked,
      edgeDismissible: !interactionLocked,
    });

    useEffect(() => {
      if (visible) {
        setTab(defaultTab);
        setPartialPage('list');
        setEditingOrder(null);
        modalRef.current?.present();
      } else {
        modalRef.current?.dismiss();
      }
    }, [defaultTab, position.key, visible]);

    useEffect(() => {
      if (
        !visible ||
        !settlement ||
        settlement.revision <= handledSettlementRevisionRef.current
      ) {
        return;
      }
      handledSettlementRevisionRef.current = settlement.revision;
      Keyboard.dismiss();
      setEditingOrder(null);
      setPartialPage('list');
      setTab(settlement.scope);
    }, [settlement, visible]);

    const handleDismiss = useCallback(() => {
      Keyboard.dismiss();
      onClose();
    }, [onClose]);
    const switchTab = useCallback(
      (next: 'partial' | 'position') => {
        if (interactionLocked) {
          return;
        }
        Keyboard.dismiss();
        setTab(next);
        setPartialPage('list');
        setEditingOrder(null);
      },
      [interactionLocked],
    );
    const visiblePosition = useMemo(
      () => ({
        ...position,
        tpslOrders: position.tpslOrders.filter(
          order => !confirmedCancelledOids.includes(order.oid),
        ),
      }),
      [confirmedCancelledOids, position],
    );
    const livePositionOrders = visiblePosition.tpslOrders.filter(
      order => order.scope === 'position',
    );
    const stablePositionOrdersRef = useRef({
      orders: livePositionOrders,
      positionKey: position.key,
    });
    if (stablePositionOrdersRef.current.positionKey !== position.key) {
      stablePositionOrdersRef.current = {
        orders: livePositionOrders,
        positionKey: position.key,
      };
    } else if (!positionPresentationLocked) {
      stablePositionOrdersRef.current.orders = livePositionOrders;
    }
    const positionFormOrders = positionPresentationLocked
      ? stablePositionOrdersRef.current.orders
      : livePositionOrders;
    const positionFormPosition = useMemo(
      () => ({
        ...visiblePosition,
        tpslOrders: [
          ...visiblePosition.tpslOrders.filter(
            order => order.scope === 'partial',
          ),
          ...positionFormOrders,
        ],
      }),
      [positionFormOrders, visiblePosition],
    );
    const positionFormResetSignature = positionFormOrders
      .map(order => `${order.oid}:${order.triggerPrice}`)
      .join('|');
    const hasPartialOrders = visiblePosition.tpslOrders.some(
      order => order.scope === 'partial',
    );
    const isPartialList =
      tab === 'partial' && partialPage === 'list' && hasPartialOrders;
    const isInlineEmpty =
      tab === 'partial' && partialPage === 'list' && !hasPartialOrders;
    const snapPoint = getPerpsProPositionTpSlSnapPoint({
      page: isPartialList ? 'list' : 'form',
      topInset: insets.top,
      windowHeight: stableWindowHeight,
    });
    const getFormMinimumHeight = useCallback(
      (presentation: PerpsProPositionTpSlFormPresentation) =>
        getPerpsProPositionTpSlFormMinimumHeight({
          presentation,
          snapPoint,
        }),
      [snapPoint],
    );
    const previousSnapPointRef = useRef(snapPoint);

    const cancelScheduledScroll = useCallback(() => {
      if (scrollFrameRef.current === null) {
        return;
      }
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }, []);
    const scheduleScrollToEnd = useCallback(
      (animated: boolean) => {
        cancelScheduledScroll();
        scrollFrameRef.current = requestAnimationFrame(() => {
          scrollFrameRef.current = null;
          scrollViewRef.current?.scrollToEnd({ animated });
        });
      },
      [cancelScheduledScroll],
    );
    const handleSheetChange = useCallback(
      (index: number, sheetPosition: number) => {
        if (index !== 0 || keyboardSessionActiveRef.current) {
          return;
        }
        const nextRestingPosition = sheetPosition;
        restingSheetPositionRef.current = nextRestingPosition;
        restingSheetPosition.value = nextRestingPosition;
      },
      [restingSheetPosition],
    );

    useEffect(() => {
      const previousSnapPoint = previousSnapPointRef.current;
      previousSnapPointRef.current = snapPoint;
      if (
        previousSnapPoint === snapPoint ||
        restingSheetPositionRef.current === null
      ) {
        return;
      }
      const nextRestingPosition =
        restingSheetPositionRef.current + previousSnapPoint - snapPoint;
      restingSheetPositionRef.current = nextRestingPosition;
      restingSheetPosition.value = nextRestingPosition;
    }, [restingSheetPosition, snapPoint]);

    useAnimatedReaction(
      () => ({
        current: animatedSheetPosition.value,
        pending: androidScrollAfterKeyboardRestore.value,
        resting: restingSheetPosition.value,
      }),
      state => {
        if (
          state.pending &&
          Number.isFinite(state.resting) &&
          state.current === state.resting
        ) {
          androidScrollAfterKeyboardRestore.value = false;
          runOnJS(scheduleScrollToEnd)(false);
        }
      },
      [scheduleScrollToEnd],
    );

    useEffect(() => {
      if (!visible) {
        keyboardSessionActiveRef.current = false;
        androidScrollAfterKeyboardRestore.value = false;
        restingSheetPositionRef.current = null;
        restingSheetPosition.value = Number.NaN;
        cancelScheduledScroll();
        return;
      }

      const keyboardShowSubscription = Keyboard.addListener(
        'keyboardDidShow',
        () => {
          keyboardSessionActiveRef.current = true;
          androidScrollAfterKeyboardRestore.value = false;
          cancelScheduledScroll();
        },
      );
      const keyboardHideSubscription = Keyboard.addListener(
        'keyboardDidHide',
        () => {
          if (!keyboardSessionActiveRef.current) {
            return;
          }
          keyboardSessionActiveRef.current = false;
          if (Platform.OS === 'android') {
            androidScrollAfterKeyboardRestore.value = true;
            return;
          }
          scheduleScrollToEnd(true);
        },
      );

      return () => {
        keyboardSessionActiveRef.current = false;
        androidScrollAfterKeyboardRestore.value = false;
        restingSheetPositionRef.current = null;
        restingSheetPosition.value = Number.NaN;
        keyboardShowSubscription.remove();
        keyboardHideSubscription.remove();
        cancelScheduledScroll();
      };
    }, [
      androidScrollAfterKeyboardRestore,
      cancelScheduledScroll,
      restingSheetPosition,
      scheduleScrollToEnd,
      visible,
    ]);

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        android_keyboardInputMode="adjustPan"
        animatedPosition={animatedSheetPosition}
        backdropProps={{
          pressBehavior: interactionLocked ? 'none' : 'close',
        }}
        backgroundStyle={styles.background}
        enableDynamicSizing={false}
        enablePanDownToClose={!interactionLocked}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onChange={handleSheetChange}
        onDismiss={handleDismiss}
        snapPoints={[snapPoint]}
        style={styles.modal}>
        <BottomSheetScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <AutoLockView style={styles.page}>
            {tab === 'partial' && partialPage !== 'list' ? (
              <>
                <PerpsProPositionTpSlPageHeader
                  onBack={requestDismiss}
                  title={t(
                    partialPage === 'add'
                      ? 'page.perps.pro.positionTpsl.addTitle'
                      : 'page.perps.pro.positionTpsl.modifyTitle',
                  )}
                />
                <PerpsProPositionTpSlHeader
                  markPrice={liveMarket.markPrice}
                  market={market}
                  position={visiblePosition}
                  variant="summary"
                />
                <PerpsProPositionTpSlForm
                  key={`${position.key}:${partialPage}:${
                    editingOrder?.oid || 'new'
                  }`}
                  amountUnit={amountUnit}
                  cancelingOids={cancelingOids}
                  initialOrder={editingOrder}
                  markPrice={liveMarket.markPrice}
                  market={market}
                  minimumHeight={getFormMinimumHeight('subpage')}
                  mode={partialPage === 'add' ? 'add' : 'modify'}
                  onCancelOrder={onCancelOrder}
                  onReview={onReview}
                  pending={interactionLocked}
                  presentation="subpage"
                  position={visiblePosition}
                />
              </>
            ) : (
              <>
                <PerpsProPositionTpSlHeader
                  markPrice={liveMarket.markPrice}
                  market={market}
                  position={visiblePosition}
                  variant={isInlineEmpty ? 'empty' : 'main'}
                />
                <View
                  style={[
                    styles.tabs,
                    isInlineEmpty ? styles.inlineEmptyTabs : null,
                  ]}
                  testID="perps-pro-position-tpsl-tabs">
                  <TabButton
                    active={tab === 'partial'}
                    label={t('page.perps.pro.positions.tpsl')}
                    onPress={() => switchTab('partial')}
                  />
                  <TabButton
                    active={tab === 'position'}
                    label={t('page.perps.pro.positions.positionTpsl')}
                    onPress={() => switchTab('position')}
                  />
                </View>
                {tab === 'position' ? (
                  <PerpsProPositionTpSlForm
                    key={`${position.key}:position:${positionFormResetSignature}`}
                    amountUnit={amountUnit}
                    cancelingOids={cancelingOids}
                    markPrice={liveMarket.markPrice}
                    market={market}
                    minimumHeight={getFormMinimumHeight('tab')}
                    mode="position"
                    onCancelOrder={onCancelOrder}
                    onReview={onReview}
                    pending={interactionLocked}
                    presentation="tab"
                    position={positionFormPosition}
                  />
                ) : isInlineEmpty ? (
                  <PerpsProPositionTpSlForm
                    key={`${position.key}:partial:inline-empty`}
                    amountUnit={amountUnit}
                    cancelingOids={cancelingOids}
                    markPrice={liveMarket.markPrice}
                    market={market}
                    minimumHeight={getFormMinimumHeight('inline-empty')}
                    mode="add"
                    onCancelOrder={onCancelOrder}
                    onReview={onReview}
                    pending={interactionLocked}
                    presentation="inline-empty"
                    position={visiblePosition}
                  />
                ) : (
                  <PerpsProPositionTpSlOrderList
                    amountUnit={amountUnit}
                    cancelingOids={cancelingOids}
                    markPrice={liveMarket.markPrice}
                    market={market}
                    onAdd={() => setPartialPage('add')}
                    onCancelOrder={onCancelOrder}
                    onModify={order => {
                      setEditingOrder(order);
                      setPartialPage('modify');
                    }}
                    onOpenEstimatedPnlExplanation={openEstimatedPnlExplanation}
                    pending={interactionLocked}
                    position={visiblePosition}
                  />
                )}
              </>
            )}
          </AutoLockView>
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    );
  },
);

PerpsProPositionTpSlSheet.displayName = 'PerpsProPositionTpSlSheet';

const TabButton: React.FC<{
  active: boolean;
  label: string;
  onPress: () => void;
}> = ({ active, label, onPress }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.activeTab]}>
      <Text style={active ? styles.activeTabText : styles.tabText}>
        {label}
      </Text>
    </Pressable>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024),
  scrollContent: { flexGrow: 1 },
  page: { flexGrow: 1 },
  tabs: {
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    height: 34,
    marginHorizontal: 15,
    marginTop: 12,
  },
  inlineEmptyTabs: { marginTop: 16 },
  tab: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  activeTab: { borderBottomColor: colors2024['neutral-title-1'] },
  tabText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  activeTabText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
