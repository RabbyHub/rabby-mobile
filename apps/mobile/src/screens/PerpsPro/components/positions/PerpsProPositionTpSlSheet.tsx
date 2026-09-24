import AutoLockView from '@/components/AutoLockView';
import {
  BOTTOM_BUTTON_BOTTOM_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { IS_ANDROID } from '@/core/native/utils';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  ANIMATION_STATUS,
  KEYBOARD_STATUS,
  SCROLLABLE_STATUS,
  useBottomSheetInternal,
  BottomSheetScrollView,
  type BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import React, {
  useLayoutEffect,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  UIManager,
  type LayoutChangeEvent,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  getPerpsProPositionTpSlFormMinimumHeight,
  getPerpsProPositionTpSlSnapPoint,
  PERPS_PRO_POSITION_TPSL_PAGE_HEADER_HEIGHT,
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
import {
  PositionTpSlAndroidScrollContext,
  usePositionTpSlAndroidScrollRestoration,
} from './usePositionTpSlAndroidScrollRestoration';

type PartialPage = 'add' | 'list' | 'modify';
type KeyboardRestoreRequest = { pageKey: string };
const LAYOUT_TOLERANCE = 1;

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
    const backButtonRef = useRef<View>(null);
    const contentRef = useAnimatedRef<View>();
    const touchRevision = useSharedValue(0);
    const nextTouchRevision = useRef(0);
    const handledSettlementRevisionRef = useRef(0);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const wasCoveredRef = useRef(coveredByReview);
    const [laidOutPage, setLaidOutPage] = useState<string | null>(null);
    const keyboardPageRef = useRef<string | null>(null);
    const pageStateRef = useRef({
      key: '',
      isOrderList: false,
      coveredByReview,
      visible,
      interactionLocked: false,
      accessoryInset: 0,
    });
    const keyboardSessionActiveRef = useRef(false);
    const scrollFrameRef = useRef<number | null>(null);
    const [keyboardRestoreRequest, setKeyboardRestoreRequest] =
      useState<KeyboardRestoreRequest | null>(null);
    const pendingKeyboardRestore = useRef<KeyboardRestoreRequest | null>(null);
    const restoredViewportHeight = useRef<number | null>(null);
    const viewportHeight = useRef(0);
    const scrollMeasurementVersion = useRef(0);
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
    const backTarget = useMemo(
      () =>
        visible && isSubpage && !interactionLocked
          ? { ref: backButtonRef, sessionKey: pageKey }
          : null,
      [interactionLocked, isSubpage, pageKey, visible],
    );
    usePerpsProSheetNavigationRegistration({
      active: visible,
      backTarget,
      dismiss: requestDismiss,
      dismissible: !interactionLocked,
      edgeDismissible: !interactionLocked,
    });
    const fixedHeaderHeight = isSubpage
      ? PERPS_PRO_POSITION_TPSL_PAGE_HEADER_HEIGHT
      : 0;
    pageStateRef.current = {
      key: pageKey,
      isOrderList,
      coveredByReview,
      visible,
      interactionLocked,
      accessoryInset: keyboard.accessoryInset,
    };
    const snapPoint = getPerpsProPositionTpSlSnapPoint({
      page,
      formBottomPaddingExtra:
        getBottomButtonBottomOffset(insets.bottom) -
        BOTTOM_BUTTON_BOTTOM_OFFSET,
      topInset: insets.top,
      windowHeight: stableWindowHeight,
    });
    const snapPoints = useMemo(() => [snapPoint], [snapPoint]);
    const androidScrollOptions = useMemo(
      () => ({
        contentRef,
        enabled: IS_ANDROID && visible && !isOrderList && !interactionLocked,
        fixedHeaderHeight,
        pageKey,
        targetHeight: snapPoint,
        touchRevision,
      }),
      [
        contentRef,
        fixedHeaderHeight,
        interactionLocked,
        isOrderList,
        pageKey,
        snapPoint,
        touchRevision,
        visible,
      ],
    );
    const getFormMinimumHeight = useCallback(
      (presentation: PerpsProPositionTpSlFormPresentation) =>
        getPerpsProPositionTpSlFormMinimumHeight({
          presentation,
          snapPoint,
        }),
      [snapPoint],
    );
    const cancelScheduledScroll = useCallback(() => {
      scrollMeasurementVersion.current++;
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    }, []);
    const cancelKeyboardRestore = useCallback(() => {
      cancelScheduledScroll();
      pendingKeyboardRestore.current = null;
      restoredViewportHeight.current = null;
      setKeyboardRestoreRequest(null);
    }, [cancelScheduledScroll]);
    const revealFormBottom = useCallback(() => {
      cancelScheduledScroll();
      const request = pendingKeyboardRestore.current;
      const expectedHeight = restoredViewportHeight.current;
      const scrollView = scrollViewRef.current;
      const isCurrent = () => {
        const current = pageStateRef.current;
        return (
          request !== null &&
          pendingKeyboardRestore.current === request &&
          request.pageKey === current.key &&
          !current.isOrderList &&
          !current.interactionLocked &&
          current.visible &&
          current.accessoryInset === 0 &&
          !keyboardSessionActiveRef.current &&
          restoredViewportHeight.current === expectedHeight &&
          scrollViewRef.current === scrollView
        );
      };
      // The sheet position and its independently animated content viewport
      // must both be restored. Layout events retry this check, never a timer.
      if (
        !isCurrent() ||
        !scrollView ||
        expectedHeight == null ||
        Math.abs(viewportHeight.current - expectedHeight) > LAYOUT_TOLERANCE
      ) {
        return;
      }
      const version = scrollMeasurementVersion.current;
      const measurementIsCurrent = () =>
        version === scrollMeasurementVersion.current && isCurrent();
      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        if (!measurementIsCurrent()) return;
        const viewportNode = scrollView.getScrollableNode();
        const contentNode = scrollView.getInnerViewNode();
        if (viewportNode == null || contentNode == null) return;
        UIManager.measureInWindow(viewportNode, (_x, top, width, height) => {
          if (
            !measurementIsCurrent() ||
            width <= 0 ||
            height <= 0 ||
            Math.abs(height - expectedHeight) > LAYOUT_TOLERANCE
          ) {
            return;
          }
          UIManager.measureInWindow(
            contentNode,
            (_contentX, contentTop, contentWidth, contentHeight) => {
              if (
                !measurementIsCurrent() ||
                contentWidth <= 0 ||
                contentHeight <= 0
              ) {
                return;
              }
              // These measurements share window coordinates, including the
              // native scroll offset. Already-visible content needs no scroll.
              const clipped =
                contentTop + contentHeight > top + height + LAYOUT_TOLERANCE;
              cancelKeyboardRestore();
              if (clipped) scrollView.scrollToEnd({ animated: false });
            },
          );
        });
      });
    }, [cancelKeyboardRestore, cancelScheduledScroll]);
    const handleKeyboardRestoreReady = useCallback(
      (request: KeyboardRestoreRequest, height: number | null) => {
        if (pendingKeyboardRestore.current !== request) return;
        restoredViewportHeight.current = height;
        revealFormBottom();
      },
      [revealFormBottom],
    );
    const handleScrollLayout = useCallback(
      (event: LayoutChangeEvent) => {
        viewportHeight.current = event.nativeEvent.layout.height;
        ensureInputVisible();
        revealFormBottom();
      },
      [ensureInputVisible, revealFormBottom],
    );
    const handleContentSizeChange = useCallback(() => {
      ensureInputVisible();
      revealFormBottom();
    }, [ensureInputVisible, revealFormBottom]);
    const handleScrollBeginDrag = useCallback(() => {
      cancelMeasurement();
      cancelKeyboardRestore();
    }, [cancelMeasurement, cancelKeyboardRestore]);
    const handleScrollTouchStart = useCallback(() => {
      if (IS_ANDROID) {
        touchRevision.value = ++nextTouchRevision.current;
      } else {
        cancelKeyboardRestore();
      }
    }, [cancelKeyboardRestore, touchRevision]);

    useEffect(() => {
      if (!visible) return;
      const show = Keyboard.addListener('keyboardDidShow', () => {
        keyboardSessionActiveRef.current = true;
        setKeyboardVisible(true);
        keyboardPageRef.current = pageStateRef.current.key;
        cancelKeyboardRestore();
      });
      const hide = Keyboard.addListener('keyboardDidHide', () => {
        const wasActive = keyboardSessionActiveRef.current;
        keyboardSessionActiveRef.current = false;
        setKeyboardVisible(false);
        const current = pageStateRef.current;
        if (
          IS_ANDROID ||
          !wasActive ||
          keyboardPageRef.current !== current.key ||
          current.isOrderList ||
          current.interactionLocked ||
          !current.visible
        ) {
          return;
        }
        const request = { pageKey: current.key };
        pendingKeyboardRestore.current = request;
        setKeyboardRestoreRequest(request);
      });
      return () => {
        keyboardSessionActiveRef.current = false;
        pendingKeyboardRestore.current = null;
        restoredViewportHeight.current = null;
        show.remove();
        hide.remove();
        cancelScheduledScroll();
      };
    }, [cancelKeyboardRestore, cancelScheduledScroll, visible]);

    useLayoutEffect(() => {
      cancelKeyboardRestore();
      cancelMeasurement();
      keyboardPageRef.current = null;
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [pageKey, cancelKeyboardRestore, cancelMeasurement]);
    useLayoutEffect(() => {
      if (interactionLocked || !visible) cancelKeyboardRestore();
      else revealFormBottom();
    }, [
      interactionLocked,
      visible,
      keyboard.accessoryInset,
      cancelKeyboardRestore,
      revealFormBottom,
    ]);
    useLayoutEffect(() => {
      if (wasCoveredRef.current && !coveredByReview && visible) {
        Keyboard.dismiss();
        setRestoring(true);
      }
      wasCoveredRef.current = coveredByReview;
      if (coveredByReview || !visible) keyboardPageRef.current = null;
    }, [coveredByReview, visible]);
    const handlePageLayout = useCallback(() => {
      if (pageStateRef.current.key !== pageKey) return;
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
        <PerpsProKeyboardSheetContext.Provider value={keyboard.sheetId}>
          {IS_ANDROID && visible && !coveredByReview ? (
            <PerpsProSheetKeyboardAnimation
              onReadyChange={keyboard.onSheetReadyChange}
            />
          ) : null}
          {keyboardRestoreRequest ? (
            <KeyboardRestorationObserver
              fixedHeaderHeight={fixedHeaderHeight}
              request={keyboardRestoreRequest}
              onReadyChange={handleKeyboardRestoreReady}
              targetHeight={snapPoint}
            />
          ) : null}
          {restoreLayoutReady ? (
            <RestoredSheetObserver
              onRestored={handleRestored}
              targetHeight={snapPoint}
            />
          ) : null}
          <PositionTpSlAndroidScrollContext.Provider
            value={androidScrollOptions}>
            <AutoLockView style={styles.listPage}>
              {isOrderList ? header : null}
              {isSubpage ? (
                <PerpsProPositionTpSlPageHeader
                  backButtonRef={backButtonRef}
                  disabled={interactionLocked}
                  onBack={requestDismiss}
                  title={t(
                    page === 'add'
                      ? 'page.perps.pro.positions.tpsl'
                      : 'page.perps.pro.positionTpsl.modifyTitle',
                  )}
                />
              ) : null}
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
                      !isOrderList &&
                        IS_ANDROID && { marginBottom: keyboard.accessoryInset },
                    ]}
                    contentContainerStyle={
                      isOrderList ? styles.orderScrollContent : undefined
                    }
                    bounces={!isOrderList}
                    overScrollMode="never"
                    scrollEnabled={!interactionLocked}
                    onLayout={handleScrollLayout}
                    onContentSizeChange={handleContentSizeChange}
                    onScrollBeginDrag={handleScrollBeginDrag}
                    onTouchStart={handleScrollTouchStart}
                    scrollEventsHandlersHook={
                      IS_ANDROID
                        ? usePositionTpSlAndroidScrollRestoration
                        : undefined
                    }
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    testID="perps-pro-position-tpsl-scroll">
                    <View
                      ref={IS_ANDROID ? contentRef : undefined}
                      collapsable={IS_ANDROID ? false : undefined}
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
                            <PerpsProPositionTpSlHeader
                              markPrice={liveMarket.markPrice}
                              market={market}
                              position={visiblePosition}
                              variant="summary"
                            />
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
                            initialOrder={
                              tab === 'partial' ? editingOrder : null
                            }
                            keyboardReveal={
                              IS_ANDROID ? keyboard.inputReveal : undefined
                            }
                            markPrice={liveMarket.markPrice}
                            market={market}
                            minimumHeight={getFormMinimumHeight(presentation)}
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
                              tab === 'position'
                                ? positionFormPosition
                                : visiblePosition
                            }
                          />
                        </>
                      )}
                    </View>
                  </BottomSheetScrollView>
                </View>
              </View>
            </AutoLockView>
          </PositionTpSlAndroidScrollContext.Provider>
        </PerpsProKeyboardSheetContext.Provider>
      </AppBottomSheetModal>
    );
  },
);

PerpsProPositionTpSlSheet.displayName = 'PerpsProPositionTpSlSheet';

/** Read the native keyboard/detent gate; content layout is checked separately. */
const KeyboardRestorationObserver = ({
  fixedHeaderHeight,
  request,
  onReadyChange,
  targetHeight,
}: {
  fixedHeaderHeight: number;
  request: KeyboardRestoreRequest;
  onReadyChange: (
    request: KeyboardRestoreRequest,
    height: number | null,
  ) => void;
  targetHeight: number;
}) => {
  const {
    animatedAnimationState,
    animatedScrollableStatus,
    animatedPosition,
    animatedDetentsState,
    animatedSheetHeight,
    animatedKeyboardState,
    animatedLayoutState,
  } = useBottomSheetInternal();
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const publish = useCallback(
    (height: number | null) => {
      if (mounted.current) onReadyChange(request, height);
    },
    [onReadyChange, request],
  );
  useAnimatedReaction(
    () => {
      const handleHeight = animatedLayoutState.value.handleHeight;
      const ready =
        animatedKeyboardState.value.status === KEYBOARD_STATUS.HIDDEN &&
        animatedAnimationState.value.status === ANIMATION_STATUS.STOPPED &&
        animatedScrollableStatus.value === SCROLLABLE_STATUS.UNLOCKED &&
        Math.abs(animatedSheetHeight.value - targetHeight) < 0.5 &&
        animatedPosition.value === animatedDetentsState.value.detents?.[0] &&
        handleHeight >= 0 &&
        targetHeight > handleHeight + fixedHeaderHeight;
      return ready ? targetHeight - handleHeight - fixedHeaderHeight : null;
    },
    (height, previous) => {
      if (height !== previous) runOnJS(publish)(height);
    },
    [fixedHeaderHeight, publish, targetHeight],
  );
  return null;
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
