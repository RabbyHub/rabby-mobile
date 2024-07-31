import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectedBridgeQuote } from '../hooks';
import { BridgeQuoteItem } from './BridgeQuoteItem';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  RcIconSwapHistoryEmpty,
  RcIconSwitchQuoteCC,
} from '@/assets/icons/swap';

const getStyles = createGetStyles(colors => ({
  container: {
    position: 'relative',
    marginTop: 26,
    borderWidth: 0.5,
    borderColor: colors['blue-default'],
    borderRadius: 4,
    cursor: 'pointer',
    color: colors['neutral-title-1'],
    fontSize: 13,
    height: 92,
    padding: 16,
    paddingTop: 24,
  },
  hoverBackground: {
    backgroundColor: colors['neutral-card-3'],
  },
  bestQuote: {
    borderColor: colors['green-default'],
  },
  emptyQuote: {
    padding: 0,
    paddingTop: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: colors['neutral-line'],
    gap: 6,
  },
  quoteSelect: {
    position: 'absolute',
    top: -12,
    left: 12,
    paddingVertical: 4,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors['blue-default'],
    fontSize: 13,
    cursor: 'pointer',
    color: colors['neutral-line'],
    backgroundColor: colors['blue-light-2'],
  },
  best: {
    borderColor: colors['green-default'],
    color: colors['green-default'],
    backgroundColor: colors['green-light'],
  },
}));

interface ReceiveDetailsProps {
  payAmount: string;
  payToken: TokenItem;
  receiveToken: TokenItem;
  loading?: boolean;
  activeProvider?: SelectedBridgeQuote;
  bestQuoteId?: {
    bridgeId: string;
    aggregatorId: string;
  };
  openQuotesList: () => void;
}
export const BridgeReceiveDetails = (props: ReceiveDetailsProps) => {
  const { t } = useTranslation();
  const { activeProvider, bestQuoteId, openQuotesList, ...other } = props;

  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const isBestQuote = useMemo(
    () =>
      !!bestQuoteId?.bridgeId &&
      activeProvider?.bridge_id === bestQuoteId?.bridgeId &&
      activeProvider?.aggregator.id === bestQuoteId?.aggregatorId,
    [activeProvider, bestQuoteId],
  );

  if (!activeProvider) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.emptyQuote]}
        onPress={openQuotesList}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <RcIconSwapHistoryEmpty width={18} height={18} />
          <Text
            style={{
              fontSize: 13,
              fontWeight: 'normal',
              color: colors['neutral-foot'],
            }}>
            {t('page.swap.No-available-quote')}
          </Text>
        </View>

        <TouchableOpacity style={styles.quoteSelect} onPress={openQuotesList}>
          <RcIconSwitchQuoteCC
            width={14}
            height={14}
            color={colors['blue-default']}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, isBestQuote ? styles.bestQuote : undefined]}
      onPress={openQuotesList}>
      <BridgeQuoteItem
        {...other}
        {...activeProvider}
        sortIncludeGasFee={false}
        bestQuoteUsd={'0'}
        onlyShow
      />
      <TouchableOpacity
        style={[styles.quoteSelect, isBestQuote && styles.best]}
        onPress={openQuotesList}>
        {isBestQuote && <Text style={styles.best}>{t('page.swap.best')}</Text>}
        <RcIconSwitchQuoteCC
          width={14}
          height={14}
          color={isBestQuote ? colors['green-default'] : colors['blue-default']}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};
