import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { IS_ANDROID } from '@/core/native/utils';
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
  type PerpsProPositionTpSlPage,
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
import {
  PerpsProPositionTpSlOrderList,
  PerpsProPositionTpSlAddRow,
} from './PerpsProPositionTpSlOrderList';
import {
  getPerpsProDialogStyles,
  resolvePerpsProDialogCardBackground,
} from '../common/perpsProDialogVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { usePerpsProFieldExplanation } from '../common/PerpsProFieldExplanationContext';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { PerpsProKeyboardSheetContext } from '../common/PerpsProKeyboardSheetContext';
import { usePerpsProSheetKeyboard } from '../common/usePerpsProSheetKeyboard';
import { PerpsProSheetKeyboardAnimation } from '../common/PerpsProSheetKeyboardAnimation';

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
    const keyboard = usePerpsProSheetKeyboard({
      visible: visible && !coveredByReview,
      scrollViewRef,
    });
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
    const [positionPage, setPositionPage] = useState<'list' | 'modify'>('list');
    const [formLayout, setFormLayout] = useState<{
      key: string;
      height: number;
    } | null>(null);
    const pendingFormLayoutRef = useRef<typeof formLayout>(null);
    const [editingOrder, setEditingOrder] =
      useState<PerpsPositionTpSlOrderViewModel | null>(null);
    const liveMarket = usePerpsProPositionMark(position.coin);
    const interactionLocked = pending || coveredByReview || reviewRequesting;
    const renderBackdrop = useCallback(
      (props: React.ComponentProps<typeof PerpsProDialogBackdrop>) => (
        <PerpsProDialogBackdrop
          {...props}
          pressBehavior={interactionLocked ? 'none' : 'close'}
        />
      ),
      [interactionLocked],
    );
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
      if (tab === 'position' && positionPage === 'modify') {
        Keyboard.dismiss();
        setPositionPage('list');
        return;
      }
      Keyboard.dismiss();
      modalRef.current?.dismiss();
    }, [
      interactionLocked,
      partialPage,
      positionPage,
      returnToPartialList,
      tab,
    ]);
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
        setPositionPage('list');
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
      setPositionPage('list');
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
        setPositionPage('list');
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
    const positionCounts = positionFormOrders.reduce(
      (counts, order) => {
        counts[order.kind] += 1;
        return counts;
      },
      { takeProfit: 0, stopLoss: 0 },
    );
    const isPositionList =
      tab === 'position' &&
      positionPage === 'list' &&
      positionFormOrders.length > 0 &&
      positionCounts.takeProfit <= 1 &&
      positionCounts.stopLoss <= 1;
    const isOrderList = isPartialList || isPositionList;
    const isSubpage =
      tab === 'partial' ? partialPage !== 'list' : positionPage === 'modify';
    const page: PerpsProPositionTpSlPage = isOrderList
      ? 'list'
      : tab === 'position'
      ? isSubpage
        ? 'position-modify'
        : 'form'
      : partialPage === 'list'
      ? 'form'
      : partialPage;
    const formLayoutKey = `${position.key}:${tab}:${page}:${
      editingOrder?.oid ?? ''
    }`;
    const handleFormContentHeightChange = useCallback(
      (height: number) => {
        if (!Number.isFinite(height) || height <= 0) return;
        const next = { key: formLayoutKey, height };
        pendingFormLayoutRef.current = next;
        if (!keyboardSessionActiveRef.current) {
          setFormLayout(current =>
            current?.key === next.key && current.height === next.height
              ? current
              : next,
          );
        }
      },
      [formLayoutKey],
    );
    const snapPoint = getPerpsProPositionTpSlSnapPoint({
      page,
      topInset: insets.top,
      windowHeight: stableWindowHeight,
      formContentHeight:
        formLayout?.key === formLayoutKey ? formLayout.height : 0,
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
          // Apply natural-content changes only after the existing keyboard restore.
          const next = pendingFormLayoutRef.current;
          if (next)
            setFormLayout(current =>
              current?.key === next.key && current.height === next.height
                ? current
                : next,
            );
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

    const tabs = (
      <View style={styles.tabCard}>
        <View style={styles.tabs} testID="perps-pro-position-tpsl-tabs">
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
      </View>
    );
    const header = (
      <PerpsProPositionTpSlHeader
        markPrice={liveMarket.markPrice}
        market={market}
        position={visiblePosition}
        title={
          isPositionList
            ? t('page.perps.pro.positions.positionTpsl')
            : undefined
        }
        variant={isInlineEmpty ? 'empty' : 'main'}
      />
    );
    const openPositionModify = () => {
      if (!interactionLocked) setPositionPage('modify');
    };
    const presentation: PerpsProPositionTpSlFormPresentation =
      tab === 'position'
        ? isSubpage
          ? 'position-modify'
          : 'tab'
        : isSubpage
        ? 'subpage'
        : 'inline-empty';

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        android_keyboardInputMode="adjustPan"
        animatedPosition={animatedSheetPosition}
        backdropComponent={renderBackdrop}
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
        <PerpsProKeyboardSheetContext.Provider value={keyboard.sheetId}>
          {IS_ANDROID && visible && !coveredByReview ? (
            <PerpsProSheetKeyboardAnimation
              onReadyChange={keyboard.onSheetReadyChange}
            />
          ) : null}
          {isOrderList ? (
            <AutoLockView style={styles.listPage}>
              {header}
              <View style={styles.listCard}>
                {tabs}
                {isPartialList ? (
                  <PerpsProPositionTpSlAddRow
                    pending={interactionLocked}
                    onAdd={() => {
                      if (!interactionLocked) setPartialPage('add');
                    }}
                  />
                ) : null}
                <BottomSheetScrollView
                  ref={scrollViewRef}
                  style={styles.orderScroll}
                  contentContainerStyle={styles.orderScrollContent}
                  showsVerticalScrollIndicator={false}
                  testID="perps-pro-position-tpsl-order-scroll">
                  <PerpsProPositionTpSlOrderList
                    scope={isPositionList ? 'position' : 'partial'}
                    amountUnit={amountUnit}
                    cancelingOids={cancelingOids}
                    markPrice={liveMarket.markPrice}
                    market={market}
                    onAdd={openPositionModify}
                    onCancelOrder={onCancelOrder}
                    onModify={order => {
                      if (interactionLocked) return;
                      if (isPositionList) openPositionModify();
                      else {
                        setEditingOrder(order);
                        setPartialPage('modify');
                      }
                    }}
                    onOpenEstimatedPnlExplanation={openEstimatedPnlExplanation}
                    pending={interactionLocked}
                    position={
                      isPositionList ? positionFormPosition : visiblePosition
                    }
                  />
                </BottomSheetScrollView>
              </View>
            </AutoLockView>
          ) : (
            <BottomSheetScrollView
              ref={scrollViewRef}
              {...(IS_ANDROID
                ? {
                    style: { marginBottom: keyboard.accessoryInset },
                    onLayout: keyboard.ensureInputVisible,
                    onContentSizeChange: keyboard.ensureInputVisible,
                    onScrollBeginDrag: keyboard.cancelMeasurement,
                  }
                : {})}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <AutoLockView style={styles.page}>
                {isSubpage ? (
                  <>
                    <PerpsProPositionTpSlPageHeader
                      onBack={requestDismiss}
                      title={t(
                        page === 'add'
                          ? 'page.perps.pro.positions.tpsl'
                          : 'page.perps.pro.positionTpsl.modifyTitle',
                      )}
                    />
                    <PerpsProPositionTpSlHeader
                      markPrice={liveMarket.markPrice}
                      market={market}
                      position={visiblePosition}
                      variant="summary"
                    />
                  </>
                ) : (
                  <>
                    {header}
                    <View style={styles.formTabs}>{tabs}</View>
                  </>
                )}
                <PerpsProPositionTpSlForm
                  key={
                    tab === 'position'
                      ? `${position.key}:position:${positionFormResetSignature}`
                      : `${position.key}:${partialPage}:${
                          editingOrder?.oid || 'new'
                        }`
                  }
                  amountUnit={amountUnit}
                  cancelingOids={cancelingOids}
                  initialOrder={tab === 'partial' ? editingOrder : null}
                  markPrice={liveMarket.markPrice}
                  market={market}
                  minimumHeight={getFormMinimumHeight(presentation)}
                  onContentHeightChange={handleFormContentHeightChange}
                  mode={
                    tab === 'position'
                      ? 'position'
                      : partialPage === 'modify'
                      ? 'modify'
                      : 'add'
                  }
                  onCancelOrder={onCancelOrder}
                  onReview={onReview}
                  pending={interactionLocked}
                  presentation={presentation}
                  position={
                    tab === 'position' ? positionFormPosition : visiblePosition
                  }
                />
              </AutoLockView>
            </BottomSheetScrollView>
          )}
        </PerpsProKeyboardSheetContext.Provider>
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

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => {
    const dialog = getPerpsProDialogStyles(
      colors2024,
      safeAreaInsets.bottom,
      isLight,
    );
    return {
      ...dialog,
      scrollContent: { flexGrow: 1 },
      page: { flexGrow: 1 },
      listPage: { flex: 1 },
      listCard: { flex: 1, marginHorizontal: 16, marginTop: 8 },
      orderScroll: { flex: 1 },
      orderScrollContent: {
        paddingBottom: Math.max(12, safeAreaInsets.bottom),
      },
      formTabs: { marginHorizontal: 16, marginTop: 8 },
      tabCard: {
        backgroundColor: resolvePerpsProDialogCardBackground(
          colors2024,
          isLight,
        ),
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        paddingTop: 4,
      },
      tabs: {
        borderBottomColor: colors2024['neutral-bg-5'],
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 12,
        height: 34,
        paddingHorizontal: 16,
      },
      tab: {
        alignItems: 'center',
        borderBottomColor: 'transparent',
        borderBottomWidth: 3,
        height: 33,
        justifyContent: 'center',
        paddingHorizontal: 2,
      },
      activeTab: { borderBottomColor: colors2024['neutral-title-1'] },
      tabText: {
        color: colors2024['neutral-secondary'],
        fontFamily: 'SF Pro Rounded',
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 18,
      },
      activeTabText: {
        color: colors2024['neutral-title-1'],
        fontFamily: 'SF Pro Rounded',
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 18,
      },
    };
  },
);
