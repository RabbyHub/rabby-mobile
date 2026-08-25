import RcCheckboxEmptyCC from '@/assets2024/icons/common/checkbox-empty-cc.svg';
import RcCheckboxFilledBrand from '@/assets2024/icons/common/checkbox-filled-brand.svg';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_COMPACT_HEIGHT,
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
import {
  getPerpsProBottomSheetChromeStyles,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  PERPS_PRO_CONFIRM_BUTTON_STYLE,
} from '../common/perpsProVisual';
import {
  getPerpsProSemanticTagContainerStyle,
  getPerpsProSemanticTagTextStyle,
} from '../common/perpsProSemanticTagStyles';
import type {
  PerpsProCloseDraft,
  PerpsProCloseMarketSnapshot,
} from '../../model/positionAction';
import {
  resolvePerpsProDisplayAmount,
  type PerpsProTradeAmountUnit,
} from '../../model/trade';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { PerpsProCloseMarketTag } from './PerpsProCloseMarketTag';

export const PerpsProCloseConfirmationSheet: React.FC<{
  amountUnit?: PerpsProTradeAmountUnit;
  draft: PerpsProCloseDraft;
  market: PerpsProCloseMarketSnapshot;
  onClose: () => void;
  onConfirm: () => void;
  onToggleSkipConfirmation: () => void;
  pending: boolean;
  position: PerpsPositionViewModel;
  skipConfirmation: boolean;
  visible: boolean;
}> = React.memo(
  ({
    draft,
    amountUnit = 'quote',
    market,
    onClose,
    onConfirm,
    onToggleSkipConfirmation,
    pending,
    position,
    skipConfirmation,
    visible,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: onClose,
      dismissible: !pending,
    });
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
        snapPoints={[302]}
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

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: skipConfirmation }}
              onPress={onToggleSkipConfirmation}
              style={styles.checkboxRow}>
              {skipConfirmation ? (
                <RcCheckboxFilledBrand height={20} width={20} />
              ) : (
                <RcCheckboxEmptyCC
                  color={colors2024['neutral-secondary']}
                  height={20}
                  width={20}
                />
              )}
              <Text style={styles.checkboxText}>
                {t(
                  draft.orderType === 'market'
                    ? 'page.perps.pro.positions.skipMarketCloseConfirmation'
                    : 'page.perps.pro.positions.skipLimitConfirmation',
                )}
              </Text>
            </Pressable>

            <View style={styles.footer}>
              <Button
                buttonStyle={PERPS_PRO_CONFIRM_BUTTON_STYLE}
                disabled={pending}
                height={BOTTOM_BUTTON_COMPACT_HEIGHT}
                loading={pending}
                onPress={onConfirm}
                title={t('global.confirm')}
                titleStyle={PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE}
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
  ...getPerpsProBottomSheetChromeStyles(colors2024),
  sheetView: { height: '100%' },
  container: { height: '100%', paddingHorizontal: 15, paddingTop: 8 },
  heading: { gap: 8 },
  pairRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  pair: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  sideRow: { flexDirection: 'row', gap: 4 },
  buyTag: getPerpsProSemanticTagContainerStyle(colors2024, 'positive'),
  sellTag: getPerpsProSemanticTagContainerStyle(colors2024, 'negative'),
  longTag: getPerpsProSemanticTagContainerStyle(colors2024, 'positive'),
  shortTag: getPerpsProSemanticTagContainerStyle(colors2024, 'negative'),
  buyTagText: getPerpsProSemanticTagTextStyle(colors2024, 'positive'),
  sellTagText: getPerpsProSemanticTagTextStyle(colors2024, 'negative'),
  longTagText: getPerpsProSemanticTagTextStyle(colors2024, 'positive'),
  shortTagText: getPerpsProSemanticTagTextStyle(colors2024, 'negative'),
  details: { marginTop: 16 },
  detailRow: {
    alignItems: 'center',
    borderBottomColor: colors2024['neutral-bg-5'],
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
