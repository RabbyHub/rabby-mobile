import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  useNavigation,
  usePreventRemove,
  useRoute,
} from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import type { Account } from '@/core/startupServices/preference';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useTheme2024 } from '@/hooks/theme';
import type {
  GetNestedScreenRouteProp,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { countFinishedLegs } from '../engine/displayStatus';
import { useMemeTradeTask } from '../hooks/useMemeTradeTask';
import { returnToMemeCoinHome } from '../navigation';
import { getExecuteButtonState } from '../ui/helpers';
import { useMemeCoinAccount } from '../ui/useMemeCoinAccount';
import { ExecuteLegRow } from './ExecuteLegRow';
import { ExitDialog } from './ExitDialog';

type ExecuteParams = TransactionNavigatorParamList['MemeCoinExecute'];

const MemeCoinExecuteContent = ({
  account,
  params,
}: {
  account: Account;
  params: ExecuteParams;
}) => {
  const { mode, legs, maxPriceImpactPct, tokenLogos } = params;
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { safeOffHeader, safeOffBottom } = useSafeSizes();
  const { store, start, openExitDialog, continueExecution, stopAndExit } =
    useMemeTradeTask({ account, legs, maxPriceImpactPct });
  const status = store(s => s.status);
  const exitDialogOpen = store(s => s.exitDialogOpen);
  const done = store(s => countFinishedLegs(s.states));
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState(false);
  const pendingActionRef = useRef<
    Parameters<typeof navigation.dispatch>[0] | null
  >(null);

  // Only user back (back button / Android back / iOS swipe) is taken over; any
  // other navigation, e.g. the auto-lock reset to Unlock, goes through as on
  // every other screen (unmounting stops the executor).
  usePreventRemove(status !== 'idle' && !leaving, ({ data }) => {
    const isUserBack =
      data.action.type === 'GO_BACK' || data.action.type === 'POP';
    if (isUserBack && store.getState().status === 'running') {
      openExitDialog();
      return;
    }
    pendingActionRef.current = isUserBack ? null : data.action;
    setLeaving(true);
  });

  // Runs after the render that turned preventRemove off, so the dispatch is not intercepted.
  useEffect(() => {
    if (!leaving) {
      return;
    }
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pendingAction) {
      navigation.dispatch(pendingAction);
    } else {
      returnToMemeCoinHome(mode);
    }
  }, [leaving, mode, navigation]);

  const handleStop = useCallback(() => {
    stopAndExit();
    setLeaving(true);
  }, [stopAndExit]);

  const handleDone = useCallback(() => setLeaving(true), []);

  const buttonState = getExecuteButtonState(status, done, legs.length);

  return (
    <View style={[styles.screen, { paddingTop: safeOffHeader }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.title}>{t('page.memeCoin.execute.title')}</Text>
            <Text style={styles.subtitle}>
              {mode === 'buy'
                ? t('page.memeCoin.execute.buySubtitleShort')
                : t('page.memeCoin.execute.sellSubtitle')}
            </Text>
          </View>
          {mode === 'sell' ? (
            <Text style={styles.estReceipt}>
              {t('page.memeCoin.execute.estReceipt')}
            </Text>
          ) : null}
        </View>
        {legs.map(leg => (
          <ExecuteLegRow
            key={leg.key}
            leg={leg}
            legs={legs}
            mode={mode}
            store={store}
            tokenLogos={tokenLogos}
          />
        ))}
      </ScrollView>
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: getBottomButtonBottomOffset(safeOffBottom) },
        ]}>
        {buttonState.kind === 'executing' ? (
          <View pointerEvents="none">
            <Button
              type="ghost"
              title={t('page.memeCoin.execute.progress', {
                done: buttonState.done,
                total: buttonState.total,
              })}
              height={BOTTOM_BUTTON_SINGLE_HEIGHT}
              titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
              buttonStyle={styles.executingButton}
              noShadow
            />
          </View>
        ) : (
          <Button
            type="primary"
            title={
              buttonState.kind === 'start'
                ? t('page.memeCoin.execute.start')
                : t('page.memeCoin.execute.done')
            }
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
            onPress={buttonState.kind === 'start' ? start : handleDone}
            noShadow
          />
        )}
      </View>
      <ExitDialog
        visible={exitDialogOpen}
        onContinue={continueExecution}
        onStop={handleStop}
      />
    </View>
  );
};

export const MemeCoinExecuteScreen = () => {
  const { styles } = useTheme2024({ getStyle });
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'MemeCoinExecute'
      >
    >();
  const { accountAddress, mode } = route.params;
  const account = useMemeCoinAccount(accountAddress, () =>
    returnToMemeCoinHome(mode),
  );

  if (!account) {
    return <View style={styles.screen} />;
  }
  return <MemeCoinExecuteContent account={account} params={route.params} />;
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-0'],
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  titleRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  subtitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-body'],
  },
  estReceipt: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  bottomBar: {
    flexShrink: 0,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    paddingHorizontal: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  executingButton: {
    backgroundColor: colors2024['brand-light-1'],
  },
}));
