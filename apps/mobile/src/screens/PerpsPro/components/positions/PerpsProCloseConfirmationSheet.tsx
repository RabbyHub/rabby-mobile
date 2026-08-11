import RcCheckboxEmptyCC from '@/assets2024/icons/common/checkbox-empty-cc.svg';
import RcCheckboxFilledBrand from '@/assets2024/icons/common/checkbox-filled-brand.svg';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_COMPACT_HEIGHT,
  BOTTOM_BUTTON_COMPACT_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { MODAL_GATE_IDS, useRegisterBlockingModal } from '@/utils/modalGate';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../../model/position';
import type {
  PerpsProCloseDraft,
  PerpsProCloseMarketSnapshot,
} from '../../model/positionAction';
import {
  resolvePerpsProDisplayAmount,
  type PerpsProTradeAmountUnit,
} from '../../model/trade';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';
import { PerpsProCloseMarketTag } from './PerpsProCloseMarketTag';

export const PerpsProCloseConfirmationSheet: React.FC<{
  amountUnit?: PerpsProTradeAmountUnit;
  draft: PerpsProCloseDraft;
  market: PerpsProCloseMarketSnapshot;
  onClose: () => void;
  onConfirm: () => void;
  onToggleSkipLimit: () => void;
  pending: boolean;
  position: PerpsPositionViewModel;
  skipLimitConfirmation: boolean;
  visible: boolean;
}> = React.memo(
  ({
    draft,
    amountUnit = 'quote',
    market,
    onClose,
    onConfirm,
    onToggleSkipLimit,
    pending,
    position,
    skipLimitConfirmation,
    visible,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    useRegisterBlockingModal(MODAL_GATE_IDS.perpsProCloseConfirmation, visible);

    useEffect(() => {
      if (visible) {
        modalRef.current?.present();
      } else {
        modalRef.current?.close();
      }
    }, [visible]);

    const isSell = position.direction === 'long';
    const displayAmount = resolvePerpsProDisplayAmount({
      amountUnit,
      baseAmount: draft.size,
      price: draft.referencePrice,
    });
    const displayUnit =
      amountUnit === 'base' ? market.displayBase : market.quoteAsset;

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        backdropProps={{ pressBehavior: pending ? 'none' : 'close' }}
        backgroundStyle={styles.background}
        enablePanDownToClose={!pending}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        onDismiss={onClose}
        snapPoints={[draft.orderType === 'limit' ? 302 : 262]}
        style={styles.modal}>
        <BottomSheetView style={styles.sheetView}>
          <AutoLockView style={styles.container}>
            <View style={styles.heading}>
              <View style={styles.pairRow}>
                <Text style={styles.pair}>{market.displayPair}</Text>
                <PerpsProCloseMarketTag sourceTag={market.sourceTag} />
              </View>
              <View style={styles.sideRow}>
                <View style={isSell ? styles.sellTag : styles.buyTag}>
                  <Text style={isSell ? styles.sellTagText : styles.buyTagText}>
                    {t(
                      isSell
                        ? 'page.perps.pro.openOrders.sell'
                        : 'page.perps.pro.openOrders.buy',
                    )}
                  </Text>
                </View>
                <View style={isSell ? styles.shortTag : styles.longTag}>
                  <Text
                    style={isSell ? styles.shortTagText : styles.longTagText}>
                    {t(
                      isSell
                        ? 'page.perps.pro.positions.short'
                        : 'page.perps.pro.positions.long',
                    )}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t('page.perps.pro.positions.price')}
                </Text>
                <Text style={styles.detailValue}>
                  {draft.orderType === 'market'
                    ? t('page.perps.pro.positions.marketPrice')
                    : `${formatPerpsProPrice(
                        draft.limitPrice,
                        market.pxDecimals,
                      )} ${market.quoteAsset}`}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t('page.perps.pro.positions.amount')}
                </Text>
                <Text style={styles.detailValue}>
                  {formatPerpsProDecimal(
                    displayAmount,
                    amountUnit === 'base' ? market.szDecimals : 2,
                  )}{' '}
                  {displayUnit}
                </Text>
              </View>
            </View>

            {draft.orderType === 'limit' ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: skipLimitConfirmation }}
                onPress={onToggleSkipLimit}
                style={styles.checkboxRow}>
                {skipLimitConfirmation ? (
                  <RcCheckboxFilledBrand height={20} width={20} />
                ) : (
                  <RcCheckboxEmptyCC
                    color={colors2024['neutral-secondary']}
                    height={20}
                    width={20}
                  />
                )}
                <Text style={styles.checkboxText}>
                  {t('page.perps.pro.positions.skipLimitConfirmation')}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.footer}>
              <Button
                disabled={pending}
                height={BOTTOM_BUTTON_COMPACT_HEIGHT}
                loading={pending}
                onPress={onConfirm}
                title={t('global.confirm')}
                titleStyle={BOTTOM_BUTTON_COMPACT_TITLE_STYLE}
                type="primary"
              />
            </View>
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);

PerpsProCloseConfirmationSheet.displayName = 'PerpsProCloseConfirmationSheet';

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
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
  sheetView: { height: '100%' },
  container: { height: '100%', paddingHorizontal: 15, paddingTop: 8 },
  heading: { gap: 8 },
  pairRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  pair: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  sideRow: { flexDirection: 'row', gap: 4 },
  buyTag: {
    backgroundColor: colors2024['green-light-1'],
    borderColor: colors2024['green-light-2'],
    borderRadius: 2,
    borderWidth: 0.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  sellTag: {
    backgroundColor: colors2024['red-light-1'],
    borderColor: colors2024['red-light-2'],
    borderRadius: 2,
    borderWidth: 0.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  longTag: {
    backgroundColor: colors2024['green-light-1'],
    borderColor: colors2024['green-light-2'],
    borderRadius: 2,
    borderWidth: 0.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  shortTag: {
    backgroundColor: colors2024['red-light-1'],
    borderColor: colors2024['red-light-2'],
    borderRadius: 2,
    borderWidth: 0.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  buyTagText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  sellTagText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  longTagText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  shortTagText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  details: { marginTop: 16 },
  detailRow: {
    alignItems: 'center',
    borderBottomColor: colors2024['neutral-line'],
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 33,
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  detailValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
  },
  checkboxText: {
    color: colors2024['neutral-title-1'],
    flex: 1,
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
  },
}));
