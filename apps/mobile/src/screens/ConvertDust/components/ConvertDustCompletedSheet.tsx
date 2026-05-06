import successAnimation from '@/assets2024/animations/animation-create-success.min.json';
import RcIconDownCC from '@/assets2024/icons/convertDust/down-cc.svg';
import RcIconSwapFailed from '@/assets2024/icons/convertDust/swap-failed.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import {
  formatAmount,
  formatTokenAmount,
  formatUsdValue,
} from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { getTokenIcon } from '@/utils/tokenIcon';
import type { Chain } from '@debank/common';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import {
  BottomSheetDraggableView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import Lottie from 'lottie-react-native';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, FlatList, TouchableOpacity, View } from 'react-native';
import { TaskStatusIcon } from './LowValueTokenSelector';
import type { TaskItemStatus } from '../hooks/useBatchSwapTask';
import { IS_ANDROID } from '@/core/native/utils';
import { LocalPannableDraggableView } from '@/components/customized/BottomSheetDraggableView';

const DETAIL_ROW_HEIGHT = 44;

const getTokenKey = (token: TokenItem, index: number) =>
  `${token.chain}:${token.id}:${index}`;

function ConvertDustDetailRow({
  status,
  token,
}: {
  status?: TaskItemStatus;
  token: TokenItem;
}) {
  const { styles } = useTheme2024({ getStyle });
  const usdValue = Number(token.amount || 0) * Number(token.price || 0);

  return (
    <View style={styles.detailRow}>
      <TaskStatusIcon taskStatus={status} />
      <AssetAvatar
        logo={token.logo_url || getTokenIcon(token.symbol)}
        size={24}
        chain={token.chain}
        chainSize={10}
        innerChainStyle={styles.detailChainBadge}
      />
      <View style={styles.detailNameColumn}>
        <Text style={styles.detailTokenSymbol} numberOfLines={1}>
          {getTokenSymbol(token)}
        </Text>
      </View>
      <View style={styles.detailValueColumn}>
        <Text style={styles.detailValue} numberOfLines={1}>
          {formatUsdValue(usdValue)}
        </Text>
        <Text style={styles.detailAmount} numberOfLines={1}>
          {formatTokenAmount(token.amount)}
        </Text>
      </View>
    </View>
  );
}

export function ConvertDustCompletedSheet({
  chain,
  receiveAmount,
  receiveToken,
  receiveUsd,
  visible,
  onDone,
  onCancel,
  isSuccess,
  taskList = [],
  statusDict = {},
}: {
  chain?: Chain | null;
  receiveAmount: number;
  receiveToken?: TokenItem | null;
  receiveUsd: number;
  visible: boolean;
  onDone: () => void;
  onCancel?: () => void;
  isSuccess?: boolean;
  taskList?: TokenItem[];
  statusDict?: Record<string, TaskItemStatus>;
}) {
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { safeOffBottom } = useSafeSizes();
  const [isDetailExpanded, setIsDetailExpanded] = React.useState(false);
  const detailListRef = React.useRef<FlatList<TokenItem>>(null);
  const shouldShowDetail = taskList.length > 0;
  const firstFailedIndex = React.useMemo(
    () =>
      taskList.findIndex(token => statusDict[token.id]?.status === 'failed'),
    [statusDict, taskList],
  );
  const hasFailedTask = firstFailedIndex >= 0;
  const receiveTokenSymbol = receiveToken
    ? getTokenSymbol(receiveToken) || 'Unknown'
    : 'Unknown';

  useEffect(() => {
    if (visible) {
      setIsDetailExpanded(hasFailedTask);
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
      setIsDetailExpanded(false);
    }
  }, [hasFailedTask, visible]);

  const renderDetailItem = React.useCallback(
    ({ item }: { item: TokenItem }) => (
      <ConvertDustDetailRow token={item} status={statusDict[item.id]} />
    ),
    [statusDict],
  );

  const scrollToFailedTask = React.useCallback(
    (animated = true) => {
      if (!isDetailExpanded || firstFailedIndex < 0) {
        return;
      }

      requestAnimationFrame(() => {
        detailListRef.current?.scrollToIndex({
          index: firstFailedIndex,
          animated,
          viewPosition: 0,
        });
      });
    },
    [firstFailedIndex, isDetailExpanded],
  );

  useEffect(() => {
    if (!visible || !hasFailedTask) {
      return;
    }

    scrollToFailedTask(false);
  }, [hasFailedTask, scrollToFailedTask, visible]);

  const handleExpandDetail = React.useCallback(() => {
    setIsDetailExpanded(true);
  }, []);

  const handleFoldDetail = React.useCallback(() => {
    setIsDetailExpanded(false);
  }, []);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      enableDynamicSizing
      enableContentPanningGesture={false}
      maxDynamicContentSize={Dimensions.get('screen').height * 0.9}
      backgroundStyle={styles.sheetBackground}
      handleStyle={styles.sheetHandle}
      handleIndicatorStyle={styles.sheetHandleIndicator}
      onDismiss={onCancel}>
      <BottomSheetView style={styles.sheetContent}>
        <LocalPannableDraggableView>
          <View style={styles.heroBlock}>
            {isSuccess ? (
              <View style={styles.lottieContainer}>
                <Lottie
                  source={successAnimation}
                  style={styles.lottie}
                  loop={false}
                  autoPlay
                />
              </View>
            ) : (
              <View style={styles.failedIconWrap}>
                <RcIconSwapFailed width={80} />
              </View>
            )}
            <Text style={styles.title}>
              {isSuccess
                ? t('page.convertDust.completed.title')
                : t('page.convertDust.completed.failedTitle')}
            </Text>
          </View>

          <View style={styles.receiveCard}>
            <View style={styles.receiveTokenWrap}>
              <AssetAvatar
                logo={receiveToken?.logo_url}
                size={46}
                chain={chain?.serverId}
                chainSize={18}
                innerChainStyle={styles.receiveChainBadge}
              />
              <Text style={styles.receiveSymbol}>{receiveTokenSymbol}</Text>
            </View>
            <View style={styles.receiveValueWrap}>
              <Text style={styles.receiveHint}>
                {t('page.convertDust.completed.receive')}{' '}
                {formatAmount(receiveAmount)} {receiveTokenSymbol}
              </Text>
              <Text style={styles.receiveValue}>
                +{formatUsdValue(receiveUsd)}
              </Text>
            </View>
          </View>
        </LocalPannableDraggableView>

        {shouldShowDetail ? (
          isDetailExpanded ? (
            <View style={styles.detailPanel}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailHeaderText}>
                  {t('page.convertDust.colStatusToken')}
                </Text>
                <Text style={styles.detailHeaderText}>
                  {t('page.convertDust.colValueAmount')}
                </Text>
              </View>
              <FlatList
                ref={detailListRef}
                style={styles.detailList}
                data={taskList}
                keyExtractor={getTokenKey}
                renderItem={renderDetailItem}
                showsVerticalScrollIndicator
                getItemLayout={(_, index) => ({
                  length: DETAIL_ROW_HEIGHT,
                  offset: DETAIL_ROW_HEIGHT * index,
                  index,
                })}
                nestedScrollEnabled
                onContentSizeChange={() => scrollToFailedTask(false)}
                onScrollToIndexFailed={info => {
                  console.log('scrollToIndexFailed', info);
                  setTimeout(() => {
                    detailListRef.current?.scrollToIndex({
                      index: info.index,
                      animated: false,
                      viewPosition: 0,
                    });
                  }, 100);
                }}
              />
              <TouchableOpacity
                style={styles.detailToggleInline}
                onPress={handleFoldDetail}>
                <Text style={styles.detailToggleText}>
                  {t('page.convertDust.completed.fold')}
                </Text>
                <RcIconDownCC
                  color={colors2024['neutral-secondary']}
                  style={styles.detailToggleIconUp}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.detailToggle}
              onPress={handleExpandDetail}>
              <Text style={styles.detailToggleText}>
                {t('page.convertDust.completed.viewMoreDetail')}
              </Text>
              <RcIconDownCC color={colors2024['neutral-secondary']} />
            </TouchableOpacity>
          )
        ) : null}

        <View style={styles.footerSpacer} />

        <View
          style={[
            styles.buttonWrap,
            { paddingBottom: Math.max(38, safeOffBottom) },
          ]}>
          <Button
            title={t('global.Done')}
            height={52}
            containerStyle={styles.buttonContainer}
            buttonStyle={styles.button}
            titleStyle={styles.buttonTitle}
            onPress={onDone}
            noShadow
          />
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sheetBackground: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  sheetHandle: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 10,
  },
  sheetHandleIndicator: {
    width: 50,
    height: 6,
    borderRadius: 100,
    backgroundColor: '#D1D4DB',
  },
  sheetContent: {
    paddingHorizontal: 20,
  },
  footerSpacer: {
    height: 20,
  },
  heroBlock: {
    marginTop: 24,
    alignItems: 'center',
  },
  lottieContainer: {
    width: 148,
    height: 141,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  failedIconWrap: {
    marginBottom: 24,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
    textAlign: 'center',
  },
  receiveCard: {
    height: 80,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiveTokenWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiveChainBadge: {
    borderWidth: 1.5,
    borderColor: colors2024['neutral-bg-1'],
  },
  receiveSymbol: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  receiveValueWrap: {
    alignItems: 'flex-end',
  },
  receiveHint: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  receiveValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
  },
  detailToggle: {
    height: 42,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-2'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  detailToggleText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  detailToggleIconUp: {
    transform: [{ rotate: '180deg' }],
  },
  detailPanel: {
    height: 208,
    marginTop: 12,
    borderRadius: 12,
    paddingTop: 12,
    backgroundColor: colors2024['neutral-bg-2'],
    overflow: 'hidden',
  },
  detailHeader: {
    height: 34,
    paddingLeft: 16,
    paddingRight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailHeaderText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  detailList: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 16,
  },
  detailRow: {
    height: DETAIL_ROW_HEIGHT,
    paddingVertical: 2,
    paddingLeft: 4,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailChainBadge: {
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-1'],
  },
  detailNameColumn: {
    minWidth: 0,
    flex: 1,
    justifyContent: 'center',
  },
  detailTokenSymbol: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  detailValueColumn: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  detailValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  detailAmount: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  detailToggleInline: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  buttonWrap: {
    paddingTop: 12,
    paddingHorizontal: 4,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  buttonContainer: {
    height: 52,
  },
  button: {
    height: 52,
    borderRadius: 12,
  },
  buttonTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
}));
