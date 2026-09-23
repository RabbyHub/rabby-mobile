import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { IS_ANDROID } from '@/core/native/utils';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  ANIMATION_STATUS,
  SCROLLABLE_STATUS,
  useBottomSheetInternal,
  BottomSheetFooter,
  BottomSheetFooterContainer,
  KEYBOARD_STATUS,
  type BottomSheetFooterProps,
  BottomSheetScrollView,
  type BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, Pressable, useWindowDimensions, View } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
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
import { usePerpsProPositionTpSlForm } from './PerpsProPositionTpSlForm';
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
import { PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT } from '../common/perpsProKeyboardSession';
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
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const wasCoveredRef = useRef(coveredByReview);
    const [laidOutPage, setLaidOutPage] = useState<string | null>(null);
    const currentPageKey = useRef('');
    const keyboard = usePerpsProSheetKeyboard({
      visible: visible && !coveredByReview,
      scrollViewRef,
    });
    const { cancelMeasurement, ensureInputVisible } = keyboard;
    const { height: windowHeight } = useWindowDimensions();
    const stableWindowHeight = useRef(windowHeight).current;
    const insets = useSafeAreaInsets();
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const openFieldExplanation = usePerpsProFieldExplanation();
    const [tab, setTab] = useState<'partial' | 'position'>(defaultTab);
    const [partialPage, setPartialPage] = useState<PartialPage>('list');
    const [positionPage, setPositionPage] = useState<'list' | 'modify'>('list');
    const [editingOrder, setEditingOrder] =
      useState<PerpsPositionTpSlOrderViewModel | null>(null);
    const liveMarket = usePerpsProPositionMark(position.coin);
    const settlementPending =
      !!settlement &&
      settlement.revision > handledSettlementRevisionRef.current;
    const interactionLocked =
      pending ||
      coveredByReview ||
      reviewRequesting ||
      settlementPending ||
      restoring;
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
      Keyboard.dismiss();
      if (coveredByReview || keyboardVisible) return;
      handledSettlementRevisionRef.current = settlement.revision;
      setRestoring(true);
      setEditingOrder(null);
      setPartialPage('list');
      setPositionPage('list');
      setTab(settlement.scope);
    }, [coveredByReview, keyboardVisible, settlement, visible]);

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
    const pageIdentity = `${visible}:${position.key}:${tab}:${page}:${
      editingOrder?.oid ?? ''
    }`;
    const pageSession = useRef({ identity: pageIdentity, revision: 0 });
    if (pageSession.current.identity !== pageIdentity) {
      pageSession.current = {
        identity: pageIdentity,
        revision: pageSession.current.revision + 1,
      };
    }
    const pageKey = `${pageIdentity}:${pageSession.current.revision}`;
    currentPageKey.current = pageKey;
    const snapPoint = getPerpsProPositionTpSlSnapPoint({
      page,
      topInset: insets.top,
      windowHeight: stableWindowHeight,
    });
    useEffect(() => {
      if (!visible) {
        setKeyboardVisible(false);
        return;
      }
      const show = Keyboard.addListener('keyboardDidShow', () =>
        setKeyboardVisible(true),
      );
      const hide = Keyboard.addListener('keyboardDidHide', () =>
        setKeyboardVisible(false),
      );
      return () => {
        show.remove();
        hide.remove();
      };
    }, [visible]);

    useLayoutEffect(() => {
      cancelMeasurement();
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [pageKey, cancelMeasurement]);
    useLayoutEffect(() => {
      if (wasCoveredRef.current && !coveredByReview && visible) {
        Keyboard.dismiss();
        setRestoring(true);
      }
      wasCoveredRef.current = coveredByReview;
    }, [coveredByReview, visible]);
    const handlePageLayout = useCallback(() => {
      if (currentPageKey.current !== pageKey) return;
      setLaidOutPage(pageKey);
      ensureInputVisible();
    }, [pageKey, ensureInputVisible]);
    const restoreLayoutReady =
      restoring &&
      !settlementPending &&
      laidOutPage === pageKey &&
      !coveredByReview &&
      !keyboardVisible;
    useEffect(() => {
      if (restoreLayoutReady) modalRef.current?.snapToIndex(0);
    }, [restoreLayoutReady, snapPoint]);
    const handleRestored = useCallback(() => {
      if (restoreLayoutReady) setRestoring(false);
    }, [restoreLayoutReady]);

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

    const formSessionKey = `${pageKey}:${
      tab === 'position' ? positionFormResetSignature : ''
    }`;
    const form = usePerpsProPositionTpSlForm({
      sessionKey: formSessionKey,
      amountUnit,
      cancelingOids,
      initialOrder: tab === 'partial' ? editingOrder : null,
      markPrice: liveMarket.markPrice,
      market,
      mode:
        tab === 'position'
          ? 'position'
          : partialPage === 'modify'
          ? 'modify'
          : 'add',
      onCancelOrder,
      onReview,
      pending: interactionLocked || isOrderList,
      presentation,
      position: tab === 'position' ? positionFormPosition : visiblePosition,
    });
    const snapPoints = useMemo(() => [snapPoint], [snapPoint]);
    const accessoryInset = IS_ANDROID ? keyboard.accessoryInset : 0;
    const footerHeight =
      BOTTOM_BUTTON_TOP_OFFSET +
      BOTTOM_BUTTON_SINGLE_HEIGHT +
      getBottomButtonBottomOffset(insets.bottom);

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        android_keyboardInputMode="adjustPan"
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        enableDynamicSizing={false}
        enablePanDownToClose={!interactionLocked}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={handleDismiss}
        snapPoints={snapPoints}
        style={styles.modal}>
        <FormFooterContext.Provider value={form.footer}>
          <PerpsProKeyboardSheetContext.Provider value={keyboard.sheetId}>
            {IS_ANDROID && visible && !coveredByReview ? (
              <PerpsProSheetKeyboardAnimation
                onReadyChange={keyboard.onSheetReadyChange}
              />
            ) : null}
            {restoreLayoutReady ? (
              <RestoredSheetObserver
                onRestored={handleRestored}
                targetHeight={snapPoint}
              />
            ) : null}
            <AutoLockView style={styles.listPage}>
              {isOrderList ? header : null}
              <View style={isOrderList ? styles.listCard : styles.listPage}>
                {isOrderList ? tabs : null}
                {isPartialList ? (
                  <PerpsProPositionTpSlAddRow
                    pending={interactionLocked}
                    onAdd={() => {
                      if (!interactionLocked) setPartialPage('add');
                    }}
                  />
                ) : null}
                <View
                  style={styles.listPage}
                  pointerEvents={interactionLocked ? 'none' : 'auto'}>
                  <BottomSheetScrollView
                    ref={scrollViewRef}
                    style={[
                      styles.orderScroll,
                      !isOrderList && {
                        marginBottom: footerHeight + accessoryInset,
                      },
                    ]}
                    contentContainerStyle={
                      isOrderList ? styles.orderScrollContent : undefined
                    }
                    bounces={!isOrderList}
                    overScrollMode="never"
                    scrollEnabled={!interactionLocked}
                    onLayout={ensureInputVisible}
                    onContentSizeChange={ensureInputVisible}
                    onScrollBeginDrag={cancelMeasurement}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    testID="perps-pro-position-tpsl-scroll">
                    <View
                      key={pageKey}
                      onLayout={handlePageLayout}
                      testID="perps-pro-position-tpsl-page-content">
                      {isOrderList ? (
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
                          onOpenEstimatedPnlExplanation={
                            openEstimatedPnlExplanation
                          }
                          pending={interactionLocked}
                          position={
                            isPositionList
                              ? positionFormPosition
                              : visiblePosition
                          }
                        />
                      ) : (
                        <>
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
                          <React.Fragment key={formSessionKey}>
                            {form.content}
                          </React.Fragment>
                        </>
                      )}
                    </View>
                  </BottomSheetScrollView>
                </View>
              </View>
            </AutoLockView>
          </PerpsProKeyboardSheetContext.Provider>
          {!isOrderList ? (
            <BottomSheetFooterContainer footerComponent={FormFooter} />
          ) : null}
        </FormFooterContext.Provider>
      </AppBottomSheetModal>
    );
  },
);

PerpsProPositionTpSlSheet.displayName = 'PerpsProPositionTpSlSheet';

// Keep the provider and the library's public footer container inside the modal
// content: Gorhom's PortalHost does not inherit context outside the modal.
const FormFooterContext = createContext<React.ReactNode>(null);
const FormFooter = (props: BottomSheetFooterProps) => {
  const content = useContext(FormFooterContext);
  const { animatedKeyboardState } = useBottomSheetInternal();
  const accessoryStyle = useAnimatedStyle(() => ({
    // The footer uses the same UI-thread keyboard state as its native position.
    // Its measured height stays constant when Done/session/IME events interleave.
    top:
      IS_ANDROID && animatedKeyboardState.value.status === KEYBOARD_STATUS.SHOWN
        ? -PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT
        : 0,
  }));
  return (
    <BottomSheetFooter {...props} style={accessoryStyle}>
      <AutoLockView>{content}</AutoLockView>
    </BottomSheetFooter>
  );
};

/** Observe native readiness; never write the library's internal gesture state. */
const RestoredSheetObserver = ({
  onRestored,
  targetHeight,
}: {
  onRestored: () => void;
  targetHeight: number;
}) => {
  const {
    animatedAnimationState,
    animatedScrollableStatus,
    animatedPosition,
    animatedDetentsState,
    animatedSheetHeight,
  } = useBottomSheetInternal();
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const publish = useCallback(() => {
    if (mounted.current) onRestored();
  }, [onRestored]);
  useAnimatedReaction(
    () =>
      animatedAnimationState.value.status === ANIMATION_STATUS.STOPPED &&
      animatedScrollableStatus.value === SCROLLABLE_STATUS.UNLOCKED &&
      Math.abs(animatedSheetHeight.value - targetHeight) < 0.5 &&
      animatedPosition.value === animatedDetentsState.value.detents?.[0],
    (ready, previous) => {
      if (ready && !previous) runOnJS(publish)();
    },
    [publish, targetHeight],
  );
  return null;
};

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
