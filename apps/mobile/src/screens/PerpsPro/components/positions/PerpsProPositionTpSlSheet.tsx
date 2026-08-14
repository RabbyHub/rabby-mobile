import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, Pressable, useWindowDimensions, View } from 'react-native';
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
  settlement?: {
    revision: number;
    scope: 'partial' | 'position';
  } | null;
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
    settlement = null,
    visible,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const handledSettlementRevisionRef = useRef(0);
    const { height: windowHeight } = useWindowDimensions();
    const stableWindowHeight = useRef(windowHeight).current;
    const insets = useSafeAreaInsets();
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const [tab, setTab] = useState<'partial' | 'position'>(defaultTab);
    const [partialPage, setPartialPage] = useState<PartialPage>('list');
    const [editingOrder, setEditingOrder] =
      useState<PerpsPositionTpSlOrderViewModel | null>(null);
    const liveMarket = usePerpsProPositionMark(position.coin);

    const returnToPartialList = useCallback(() => {
      Keyboard.dismiss();
      setEditingOrder(null);
      setPartialPage('list');
    }, []);
    const requestDismiss = useCallback(() => {
      if (pending || coveredByReview) {
        return;
      }
      if (tab === 'partial' && partialPage !== 'list') {
        returnToPartialList();
        return;
      }
      Keyboard.dismiss();
      modalRef.current?.dismiss();
    }, [coveredByReview, partialPage, pending, returnToPartialList, tab]);
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: requestDismiss,
      dismissible: !pending && !coveredByReview,
      edgeDismissible: !pending && !coveredByReview,
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
        if (pending) {
          return;
        }
        Keyboard.dismiss();
        setTab(next);
        setPartialPage('list');
        setEditingOrder(null);
      },
      [pending],
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
    const fullOrderSignature = visiblePosition.tpslOrders
      .filter(order => order.scope === 'position')
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

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        android_keyboardInputMode="adjustPan"
        backdropProps={{
          pressBehavior: coveredByReview || pending ? 'none' : 'close',
        }}
        backgroundStyle={styles.background}
        enableDynamicSizing={false}
        enablePanDownToClose={!coveredByReview && !pending}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={handleDismiss}
        snapPoints={[snapPoint]}
        style={styles.modal}>
        <BottomSheetScrollView
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
                  pending={pending}
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
                    key={`${position.key}:position:${fullOrderSignature}`}
                    amountUnit={amountUnit}
                    cancelingOids={cancelingOids}
                    markPrice={liveMarket.markPrice}
                    market={market}
                    minimumHeight={getFormMinimumHeight('tab')}
                    mode="position"
                    onCancelOrder={onCancelOrder}
                    onReview={onReview}
                    pending={pending}
                    presentation="tab"
                    position={visiblePosition}
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
                    pending={pending}
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
                    pending={pending}
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
  modal: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  background: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: 40,
    paddingBottom: 27,
    paddingTop: 9,
  },
  handleIndicator: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 2,
    height: 4,
    width: 40,
  },
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
    fontFamily: 'SF Pro',
    fontSize: 14,
    lineHeight: 18,
  },
  activeTabText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
