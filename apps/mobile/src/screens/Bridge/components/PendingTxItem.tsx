import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useInterval, useMemoizedFn } from 'ahooks';
import BigNumber from 'bignumber.js';
import SvgIcPending from '@/assets2024/icons/bridge/IconPendingCC.svg';
import RcIconSelectCC from '@/assets2024/icons/bridge/IconSelectCC.svg';
import RcIconFailedCC from '@/assets2024/icons/bridge/IconFailedCC.svg';
import RcIconQueuedCC from '@/assets2024/icons/bridge/IconQueueCC.svg';
import RcIconBridgeStep1Light from '@/assets2024/icons/bridge/IconBridgeStep1Light.svg';
import RcIconBridgeStep1Dark from '@/assets2024/icons/bridge/IconBridgeStep1Dark.svg';

import RcIconBridgeStep2Light from '@/assets2024/icons/bridge/IconBridgeStep2Light.svg';
import RcIconBridgeStep2Dark from '@/assets2024/icons/bridge/IconBridgeStep2Dark.svg';
import RcIconBridgeStepArrowCC from '@/assets2024/icons/bridge/IconBridgeStepArrowCC.svg';

import RcIconBridgeRightArrowCC from '@/assets2024/icons/bridge/IconRightArrowCC.svg';

import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { AssetAvatar } from '@/components';
import { ONE_DAY_MS, ONE_HOUR_MS, ONE_MINUTE_MS } from '../constants';
import { openapi } from '@/core/request';
import { transactionHistoryService } from '@/core/services';
import { Button } from '@/components2024/Button';
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useScreenSceneAccountContext } from '@/hooks/accountsSwitcher';
import { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';

type StepStatusType = 'loading' | 'success' | 'failed' | 'queued' | 'dash';

const getStepStatusStyles = createGetStyles2024(({ colors2024 }) => ({
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    marginRight: 2,
  },
  dashText: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  iconWrapper: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

const getStepIndicatorStyles = createGetStyles2024(({ colors2024 }) => ({
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorArrow: {
    marginHorizontal: 6,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
}));

const getPendingStatusStyles = createGetStyles2024(({ colors2024 }) => ({
  detailContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 2,
    flex: 1,
  },
  titleWrapper: {
    alignItems: 'center',
    marginBottom: 12,
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  card: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    overflow: 'hidden',
    paddingLeft: 50,
    paddingBottom: 16,
    paddingRight: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 8,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  stepIcon: {
    position: 'absolute',
    left: 12,
    top: 17,
    width: 26,
    height: 24,
  },
  stepArrow: {
    position: 'absolute',
    left: 16,
    top: 51,
    width: 19,
    height: 81,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    marginRight: 6,
  },
  stepTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statusBadgeIcon: {
    marginRight: 4,
  },
  statusBadgeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    zIndex: 2,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenAmount: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    marginLeft: 8,
  },
  tokenUsd: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  failureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  failureText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  arrowWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
  arrowText: {
    color: colors2024['neutral-foot'],
    opacity: 0.6,
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  receiveCardFailed: {
    marginBottom: 32,
  },
  opacity40: {
    opacity: 0.4,
  },
  lineThrough: {
    textDecorationLine: 'line-through',
  },
  bottomArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  bottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  bottomText: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    flexShrink: 1,
  },
  swapText: {
    position: 'relative',
    top: 2,
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  innerChainStyle: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-1'],
  },
  btn: {
    marginTop: 'auto',
  },
}));

const StepStatusIcon = ({
  status,
  step = 1,
  size = 16,
}: {
  status: StepStatusType;
  step: 1 | 2;
  size?: number;
}) => {
  const { styles: stepStyles, colors2024 } = useTheme2024({
    getStyle: getStepStatusStyles,
  });
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status !== 'loading') {
      rotateAnim.stopAnimation(() => rotateAnim.setValue(0));
      return;
    }

    const animation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => {
      animation.stop();
      rotateAnim.setValue(0);
    };
  }, [rotateAnim, status]);

  const rotateStyle = useMemo(
    () => ({
      transform: [
        {
          rotate: rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }),
        },
      ],
    }),
    [rotateAnim],
  );

  const statusColor = useMemo(() => {
    switch (status) {
      case 'loading':
        return colors2024['orange-default'];
      case 'success':
        return colors2024['green-default'];
      case 'failed':
        return colors2024['red-default'];
      case 'queued':
        return colors2024['neutral-foot'];
      case 'dash':
      default:
        return colors2024['neutral-info'];
    }
  }, [colors2024, status]);

  const renderStatusIcon = () => {
    switch (status) {
      case 'loading':
        return (
          <Animated.View style={[stepStyles.iconWrapper, rotateStyle]}>
            <SvgIcPending width={size} height={size} color={statusColor} />
          </Animated.View>
        );
      case 'success':
        return (
          <View style={stepStyles.iconWrapper}>
            <RcIconSelectCC width={size} height={size} color={statusColor} />
          </View>
        );
      case 'failed':
        return (
          <View style={stepStyles.iconWrapper}>
            <RcIconFailedCC width={size} height={size} color={statusColor} />
          </View>
        );
      case 'queued':
        return (
          <View style={stepStyles.iconWrapper}>
            <RcIconQueuedCC width={size} height={size} color={statusColor} />
          </View>
        );
      case 'dash':
        return <Text style={stepStyles.dashText}>-</Text>;
      default:
        return null;
    }
  };

  return (
    <View style={stepStyles.stepContainer}>
      <Text style={[stepStyles.stepText, { color: statusColor }]}>
        {`${step}.`}
      </Text>
      {renderStatusIcon()}
    </View>
  );
};

// Two-step status indicator component
const StepStatusIndicator = ({
  step1Status,
  step2Status,
}: {
  step1Status: StepStatusType;
  step2Status: StepStatusType;
}) => {
  const { styles: indicatorStyles, colors2024 } = useTheme2024({
    getStyle: getStepIndicatorStyles,
  });

  return (
    <View style={indicatorStyles.indicatorContainer}>
      <StepStatusIcon step={1} status={step1Status} />
      <Text style={indicatorStyles.indicatorArrow}>→</Text>
      <StepStatusIcon step={2} status={step2Status} />
      <RcIconBridgeRightArrowCC color={colors2024['neutral-secondary']} />
    </View>
  );
};

const DashLabel = () => {
  const { styles: pendingStyles, colors2024 } = useTheme2024({
    getStyle: getPendingStatusStyles,
  });
  return (
    <Text
      style={[
        pendingStyles.statusBadgeText,
        { color: colors2024['neutral-foot'] },
      ]}>
      -
    </Text>
  );
};

const OtherLabel = ({
  status,
  statusBadgeMeta,
}: {
  status: StepStatusType;

  statusBadgeMeta: Record<
    string,
    {
      label: string;
      color: string;
      bg: string;
      icon: React.JSX.Element;
    }
  >;
}) => {
  const { styles: pendingStyles } = useTheme2024({
    getStyle: getPendingStatusStyles,
  });

  const rotateAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (status !== 'loading') {
      rotateAnim.stopAnimation(() => rotateAnim.setValue(0));
      return;
    }

    const animation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => {
      animation.stop();
      rotateAnim.setValue(0);
    };
  }, [rotateAnim, status]);

  const rotateStyle = useMemo(
    () => ({
      transform: [
        {
          rotate: rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }),
        },
      ],
    }),
    [rotateAnim],
  );

  const meta = statusBadgeMeta[status as keyof typeof statusBadgeMeta];

  const icon =
    (status as any) === 'loading' ? (
      <Animated.View style={[pendingStyles.statusBadgeIcon, rotateStyle]}>
        {meta.icon}
      </Animated.View>
    ) : (
      <View style={pendingStyles.statusBadgeIcon}>{meta.icon}</View>
    );

  return (
    <View style={[pendingStyles.statusBadge, { backgroundColor: meta.bg }]}>
      {icon}
      <Text
        style={[
          pendingStyles.statusBadgeText,
          { color: meta.color, opacity: 1 },
        ]}>
        {meta.label}
      </Text>
    </View>
  );
};

// Bridge Status Detail Component
const PendingStatusDetail = ({
  data,
  status,
  step1Status,
  step2Status,
  onClose,
}: {
  data: BridgeTxHistoryItem;
  status: 'pending' | 'fromSuccess' | 'fromFailed' | 'allSuccess' | 'failed';
  step1Status: StepStatusType;
  step2Status: StepStatusType;
  onClose: () => void;
}) => {
  const {
    styles: pendingStyles,
    colors2024,
    isLight,
  } = useTheme2024({
    getStyle: getPendingStatusStyles,
  });
  const { t } = useTranslation();
  const [refreshEstTime, setRefreshEstTime] = useState(0);

  const fromChain = findChain({ serverId: data.fromToken?.chain || '' });
  const toChain = findChain({ serverId: data.toToken?.chain || '' });

  const payUsdValue = useMemo(() => {
    if (!data.fromToken?.price || !data.fromAmount) {
      return '0';
    }
    return new BigNumber(data.fromAmount)
      .multipliedBy(data.fromToken.price)
      .toString();
  }, [data.fromToken?.price, data.fromAmount]);

  const estimatedDuration = useMemo(() => {
    if (
      step2Status === 'loading' &&
      data.fromTxCompleteTs &&
      refreshEstTime >= 0
    ) {
      const elapsed = Date.now() - data.fromTxCompleteTs;
      const estimatedDurationMs = Math.max(
        data.estimatedDuration * 1000,
        ONE_MINUTE_MS,
      );
      const remainingDuration = estimatedDurationMs - elapsed;
      if (remainingDuration <= 0) {
        return -1;
      }
      return Math.max(Math.round(remainingDuration / 60000), 1);
    }
    return null;
  }, [
    data.estimatedDuration,
    data.fromTxCompleteTs,
    step2Status,
    refreshEstTime,
  ]);

  useInterval(() => {
    if (data?.status === 'fromSuccess') {
      setRefreshEstTime(e => e + 1);
    }
  }, 1000);

  const receiveItem = useMemo(() => {
    const token = data.actualToToken || data.toToken;
    const amount = data.actualToAmount || data.toAmount;
    const usdValue = new BigNumber(amount || 0)
      .multipliedBy(token?.price || 0)
      .toString();
    return {
      token,
      amount,
      usdValue,
    };
  }, [data.actualToAmount, data.actualToToken, data.toAmount, data.toToken]);

  const receiveItemNeedOpacity = useMemo(() => {
    return (
      status === 'fromFailed' ||
      status === 'pending' ||
      (!data.actualToToken && status === 'failed')
    );
  }, [status, data.actualToToken]);

  const receiveNotRightToken = useMemo(() => {
    return (
      data.actualToToken &&
      (data.actualToToken?.id !== data.toToken?.id ||
        data.actualToToken?.chain !== data.toToken?.chain)
    );
  }, [data.actualToToken, data.toToken]);

  const statusBadgeMeta = useMemo(() => {
    const orangeBg = colors2024['orange-light-1'];
    const greenBg = colors2024['green-light-1'];
    const redBg = colors2024['red-light-1'];
    const queuedBg = 'transparent';

    return {
      loading: {
        label: t('page.bridge.pendingItem.pending'),
        color: colors2024['orange-default'],
        bg: orangeBg,
        icon: (
          <SvgIcPending
            width={16}
            height={16}
            color={colors2024['orange-default']}
          />
        ),
      },
      success: {
        label: t('page.bridge.pendingItem.completed'),
        color: colors2024['green-default'],
        bg: greenBg,
        icon: (
          <RcIconSelectCC
            width={16}
            height={16}
            color={colors2024['green-default']}
          />
        ),
      },
      failed: {
        label: t('page.bridge.pendingItem.failed'),
        color: colors2024['red-default'],
        bg: redBg,
        icon: (
          <RcIconFailedCC
            width={16}
            height={16}
            color={colors2024['red-default']}
          />
        ),
      },
      queued: {
        label: t('page.bridge.pendingItem.queued'),
        color: colors2024['neutral-foot'],
        bg: queuedBg,
        icon: (
          <RcIconQueuedCC
            width={16}
            height={16}
            color={colors2024['neutral-foot']}
          />
        ),
      },
    };
  }, [colors2024, t]);

  const StatusLabel = useCallback(
    ({ status }: { status: StepStatusType }) => {
      if (status === 'dash') {
        return <DashLabel />;
      }

      const meta = statusBadgeMeta[status];
      if (!meta) {
        return null;
      }

      return <OtherLabel status={status} statusBadgeMeta={statusBadgeMeta} />;
    },
    [statusBadgeMeta],
  );

  const TokenWithChain = ({
    token,
    chain,
  }: {
    token?: string | null;
    chain?: string | null;
  }) => (
    <AssetAvatar
      logo={token || undefined}
      chain={chain || undefined}
      size={20}
      chainSize={14}
      innerChainStyle={pendingStyles.innerChainStyle}
    />
  );

  const { ofScreen } = useScreenSceneAccountContext();

  const ReceiveBottomArea = useMemo(() => {
    if (status === 'failed') {
      const showSwap = data.actualToToken?.chain === data.toToken?.chain;
      const isReturn =
        data.actualToToken?.chain === data.fromToken?.chain &&
        data.actualToToken?.id === data.fromToken?.id;
      const isReturnSourceChain =
        data.actualToToken?.chain === data.fromToken?.chain;

      let message = t('page.bridge.pendingItem.BridgeStatusUnavailable');
      if (isReturn) {
        message = t('page.bridge.pendingItem.beReturnFailed');
      } else if (showSwap) {
        message = t('page.bridge.pendingItem.receivedDifferentTokenNeedSwap');
      } else if (isReturnSourceChain) {
        message = t('page.bridge.pendingItem.receivedDifferentTokenFromSource');
      }

      const goToSwap = () => {
        if (data.actualToToken && data.toToken) {
          onClose();
          naviPush(RootNames.StackTransaction, {
            screen:
              ofScreen === RootNames.MultiBridge
                ? RootNames.MultiSwap
                : RootNames.Swap,
            params: {
              chainEnum: findChain({ serverId: data.toToken?.chain })?.enum,
              swapTokenId: [data.actualToToken?.id, data.toToken.id],
              swapAgain: true,
            },
          });
          return;
        }
        if (data.actualToToken) {
          onClose();
          naviPush(RootNames.StackTransaction, {
            screen:
              ofScreen === RootNames.MultiBridge
                ? RootNames.MultiSwap
                : RootNames.Swap,
            params: {
              chainEnum: findChain({ serverId: data.toToken?.chain })?.enum,
              tokenId: data.actualToToken?.id,
              isFromSwap: true,
            },
          });
        }
      };

      return (
        <View style={pendingStyles.bottomArea}>
          <View style={pendingStyles.bottomLeft}>
            <Text
              style={[
                pendingStyles.bottomText,
                { color: colors2024['red-default'] },
              ]}>
              {message}
              {showSwap ? (
                <Pressable onPress={goToSwap}>
                  <Text style={pendingStyles.swapText}>
                    {' '}
                    {t('page.bridge.pendingItem.swap')}
                  </Text>
                </Pressable>
              ) : null}
            </Text>
          </View>
        </View>
      );
    }

    if (estimatedDuration) {
      if (estimatedDuration === -1) {
        return (
          <View style={pendingStyles.bottomArea}>
            <View style={pendingStyles.bottomLeft}>
              <Text
                style={[
                  pendingStyles.bottomText,
                  { color: colors2024['orange-default'] },
                ]}>
                {t('page.bridge.pendingItem.longTimeNoReceive')}
              </Text>
            </View>
          </View>
        );
      }

      return (
        <View style={pendingStyles.bottomArea}>
          <Text style={pendingStyles.bottomText}>
            {t('page.bridge.pendingItem.estimatedTime')}
          </Text>
          <Text
            style={pendingStyles.bottomText}>{`${estimatedDuration}min`}</Text>
        </View>
      );
    }

    return null;
  }, [
    colors2024,
    data.actualToToken,
    data.fromToken?.chain,
    data.fromToken?.id,
    data.toToken,
    estimatedDuration,
    ofScreen,
    onClose,
    pendingStyles.bottomArea,
    pendingStyles.bottomLeft,
    pendingStyles.bottomText,
    pendingStyles.swapText,
    status,
    t,
  ]);

  const { bottom } = useSafeAreaInsets();

  const Step1 = isLight ? RcIconBridgeStep1Light : RcIconBridgeStep1Dark;
  const Step2 = isLight ? RcIconBridgeStep2Light : RcIconBridgeStep2Dark;

  return (
    <View style={pendingStyles.detailContainer}>
      <View style={pendingStyles.titleWrapper}>
        <Text style={pendingStyles.titleText}>
          {t('page.bridge.pendingItem.bridgeStatus')}
        </Text>
      </View>

      <View>
        <View style={pendingStyles.card}>
          <Step1 style={pendingStyles.stepIcon} />

          <View style={pendingStyles.cardHeader}>
            <View style={pendingStyles.stepRow}>
              <Text style={pendingStyles.stepTitle}>
                {t('page.bridge.pendingItem.sendingFrom', {
                  chain: fromChain?.name || '',
                })}
              </Text>
            </View>
            <StatusLabel status={step1Status} />
          </View>
          <View style={{ gap: 8 }}>
            <View style={pendingStyles.tokenRow}>
              <View style={pendingStyles.tokenLeft}>
                <TokenWithChain
                  token={data.fromToken?.logo_url}
                  chain={data.fromToken?.chain || ''}
                />
                <Text style={pendingStyles.tokenAmount}>
                  {'- '}
                  {formatTokenAmount(data.fromAmount || 0)}{' '}
                  {getTokenSymbol(data.fromToken)}
                </Text>
              </View>
              <Text style={pendingStyles.tokenUsd}>
                -{formatUsdValue(payUsdValue)}
              </Text>
            </View>
            {status === 'fromFailed' && (
              <View style={pendingStyles.failureBanner}>
                <Text
                  style={[
                    pendingStyles.failureText,
                    { color: colors2024['red-default'] },
                  ]}>
                  {t('page.bridge.pendingItem.fromFailed')}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View
          style={[
            pendingStyles.card,
            { marginTop: 16 },
            status === 'failed' ? pendingStyles.receiveCardFailed : null,
          ]}>
          <Step2 style={pendingStyles.stepIcon} />
          <View style={pendingStyles.cardHeader}>
            <View style={pendingStyles.stepRow}>
              <Text
                style={[
                  pendingStyles.stepTitle,
                  receiveItemNeedOpacity ? pendingStyles.opacity40 : null,
                ]}>
                {t('page.bridge.pendingItem.receivingTo', {
                  chain: toChain?.name || '',
                })}
              </Text>
            </View>
            <StatusLabel status={step2Status} />
          </View>

          <View style={{ gap: 12 }}>
            {status === 'failed' && receiveNotRightToken && (
              <View style={pendingStyles.tokenRow}>
                <View style={pendingStyles.tokenLeft}>
                  <TokenWithChain
                    token={data.toToken?.logo_url}
                    chain={data.toToken?.chain || ''}
                  />
                  <Text
                    style={[
                      pendingStyles.tokenAmount,
                      pendingStyles.opacity40,
                      pendingStyles.lineThrough,
                    ]}>
                    {'+ '}
                    {formatTokenAmount(data.toAmount || 0)}{' '}
                    {getTokenSymbol(data.toToken)}
                  </Text>
                </View>
                <Text
                  style={[
                    pendingStyles.tokenUsd,
                    pendingStyles.opacity40,
                    pendingStyles.lineThrough,
                  ]}>
                  +
                  {formatUsdValue(
                    (data.toAmount || 0) * (data.toToken?.price || 0),
                  )}
                </Text>
              </View>
            )}

            <View style={pendingStyles.tokenRow}>
              <View style={pendingStyles.tokenLeft}>
                <TokenWithChain
                  token={receiveItem.token?.logo_url}
                  chain={receiveItem.token?.chain || ''}
                />
                <Text
                  style={[
                    pendingStyles.tokenAmount,
                    receiveItemNeedOpacity ? pendingStyles.opacity40 : null,
                  ]}>
                  {'+ '}
                  {formatTokenAmount(receiveItem.amount || 0)}{' '}
                  {getTokenSymbol(receiveItem.token)}
                </Text>
              </View>
              <Text
                style={[
                  pendingStyles.tokenUsd,
                  receiveItemNeedOpacity ? pendingStyles.opacity40 : null,
                ]}>
                +{formatUsdValue(receiveItem.usdValue)}
              </Text>
            </View>
            {ReceiveBottomArea}
          </View>
        </View>
        <RcIconBridgeStepArrowCC style={pendingStyles.stepArrow} />
      </View>

      <Button
        onPress={onClose}
        title={t('global.GotIt')}
        containerStyle={[
          pendingStyles.btn,
          {
            marginBottom: Math.max(48, bottom),
          },
        ]}
      />
    </View>
  );
};
export const BridgePendingTxItem = ({
  userAddress,
}: {
  userAddress: string;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getItemStyles });
  const { t } = useTranslation();
  const sheetRef = useRef<AppBottomSheetModal>(null);
  const [data, setData] = useState<BridgeTxHistoryItem | null>(null);

  const fetchHistory = useCallback(async () => {
    const historyData = transactionHistoryService.getRecentPendingTxHistory(
      userAddress,
      'bridge',
    ) as BridgeTxHistoryItem;

    // tx create time is more than one day, set this tx failed and no show in loading pendingTxItem
    if (
      historyData?.createdAt &&
      Date.now() - historyData.createdAt > ONE_DAY_MS
    ) {
      transactionHistoryService.completeBridgeTxHistory(
        historyData?.hash,
        historyData.fromChainId!,
        'failed',
      );

      setData(null);
      return;
    }

    setData(historyData);
    if (
      historyData &&
      historyData.hash &&
      (historyData.status === 'pending' || historyData.status === 'fromSuccess')
    ) {
      const res = await openapi.getBridgeHistoryList({
        user_addr: userAddress,
        start: 0,
        limit: 10,
        is_all: true,
      });
      const bridgeHistoryList = res.history_list;
      if (bridgeHistoryList && bridgeHistoryList?.length > 0) {
        const hash = historyData.acceleratedHash || historyData.hash;
        const findTx = bridgeHistoryList.find(
          item => item.from_tx?.tx_id === hash,
        );
        if (!findTx) {
          const currentTime = Date.now();
          const txCreateTime = historyData.createdAt;
          if (currentTime - txCreateTime > ONE_HOUR_MS) {
            // tx create time is more than 60 minutes, set this tx failed
            transactionHistoryService.completeBridgeTxHistory(
              historyData.hash,
              historyData.fromChainId!,
              'failed',
            );
            setData(null);
          }
        } else {
          if (findTx.status === 'completed' || findTx.status === 'failed') {
            const status =
              findTx.status === 'completed' ? 'allSuccess' : 'failed';
            const updateData = {
              ...historyData,
              status,
              actualToToken: findTx.to_actual_token,
              actualToAmount: findTx.actual.receive_token_amount,
              completedAt: Date.now(),
            };
            setData(updateData as BridgeTxHistoryItem);
            transactionHistoryService.completeBridgeTxHistory(
              historyData.hash,
              historyData.fromChainId!,
              status,
              findTx,
            );
          } else {
            setData(historyData);
          }
        }
      }
    }
  }, [userAddress]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const fetchRefreshLocalData = useMemoizedFn((data: BridgeTxHistoryItem) => {
    if (data.status !== 'pending') {
      // has done
      return;
    }

    const address = data.address;
    const chainId = data.fromChainId;
    const hash = data.hash;
    const newData = transactionHistoryService.getRecentTxHistory(
      address,
      hash,
      chainId!,
      'bridge',
    );

    if (newData?.status !== 'pending') {
      return newData;
    }
  });

  const handleBridgeHistoryUpdate = useMemoizedFn(
    (bridgeHistoryList: BridgeHistory[]) => {
      if (
        !data?.hash ||
        (data.status !== 'pending' && data.status !== 'fromSuccess')
      ) {
        return;
      }

      const recentlyTxHash = data?.acceleratedHash || data?.hash;
      const findTx = bridgeHistoryList.find(
        item => item.from_tx?.tx_id === recentlyTxHash,
      );

      if (!findTx) {
        const currentTime = Date.now();
        const txCreateTime = data?.createdAt;
        if (currentTime - txCreateTime > ONE_HOUR_MS) {
          // tx create time is more than 60 minutes, set this tx failed
          transactionHistoryService.completeBridgeTxHistory(
            recentlyTxHash,
            data?.fromChainId,
            'failed',
          );
          setData(null);
          return;
        }
      }

      if (
        findTx &&
        (findTx.status === 'completed' || findTx.status === 'failed')
      ) {
        const status = findTx.status === 'completed' ? 'allSuccess' : 'failed';
        const updateData = {
          ...data,
          status,
          actualToToken: findTx.to_actual_token,
          actualToAmount: findTx.actual.receive_token_amount,
          completedAt: Date.now(),
        };
        setData(updateData as BridgeTxHistoryItem);
        transactionHistoryService.completeBridgeTxHistory(
          recentlyTxHash,
          data.fromChainId,
          status,
          findTx,
        );
      }
    },
  );

  useInterval(async () => {
    const recentlyTxHash = data?.hash;
    if (
      recentlyTxHash &&
      (data.status === 'pending' || data.status === 'fromSuccess')
    ) {
      const res = await openapi.getBridgeHistoryList({
        user_addr: userAddress,
        start: 0,
        limit: 10,
        is_all: true,
      });
      const bridgeHistoryList = res.history_list;
      if (bridgeHistoryList && bridgeHistoryList?.length > 0) {
        handleBridgeHistoryUpdate(bridgeHistoryList);
      }
    }
  }, 3 * 1000);

  useInterval(async () => {
    if (data?.status === 'pending' || data?.status === 'fromSuccess') {
      const refreshTx = await fetchRefreshLocalData(data);
      if (refreshTx) {
        setData(refreshTx as BridgeTxHistoryItem);
      }
    }
  }, 1000);

  const status = data?.status || 'pending';

  const { step1Status, step2Status } = useMemo(() => {
    let first: StepStatusType = 'loading';
    let second: StepStatusType = 'queued';
    switch (status) {
      case 'fromSuccess':
        first = 'success';
        second = 'loading';
        break;
      case 'fromFailed':
        first = 'failed';
        second = 'dash';
        break;
      case 'allSuccess':
        first = 'success';
        second = 'success';
        break;
      case 'failed':
        first = 'success';
        second = 'failed';
        break;
      case 'pending':
      default:
        first = 'loading';
        second = 'queued';
        break;
    }
    return { step1Status: first, step2Status: second };
  }, [status]);

  const openDetail = useCallback(() => {
    sheetRef.current?.present();
  }, []);

  const closeDetail = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  if (!data) {
    return null;
  }

  return (
    <>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          gap: 10,
          paddingTop: 12,
          marginHorizontal: 20,
        }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors2024['neutral-line'],
            height: 1,
          }}
        />
        <View
          style={{
            width: 3,
            height: 3,
            borderRadius: 9999,
            backgroundColor: colors2024['neutral-info'],
          }}
        />
        <View
          style={{
            height: 1,
            flex: 1,
            backgroundColor: colors2024['neutral-line'],
          }}
        />
      </View>
      <TouchableOpacity style={styles.card} onPress={openDetail}>
        <View style={styles.tokenRow}>
          <AssetAvatar
            logo={data.fromToken?.logo_url}
            chain={data.fromToken?.chain}
            chainSize={14}
            size={24}
            innerChainStyle={styles.innerChainStyle}
          />
          <Text style={styles.tokenText}>{getTokenSymbol(data.fromToken)}</Text>
          <Text style={styles.arrowText}>→</Text>
          <AssetAvatar
            logo={data.toToken?.logo_url}
            chain={data.toToken?.chain}
            chainSize={14}
            size={24}
            innerChainStyle={styles.innerChainStyle}
          />
          <Text style={styles.tokenText}>{getTokenSymbol(data.toToken)}</Text>
        </View>

        <StepStatusIndicator
          step1Status={step1Status}
          step2Status={step2Status}
        />
      </TouchableOpacity>

      <AppBottomSheetModal
        ref={sheetRef}
        snapPoints={[652]}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}>
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {data ? (
            <>
              <PendingStatusDetail
                data={data}
                status={status}
                step1Status={step1Status}
                step2Status={step2Status}
                onClose={closeDetail}
              />
            </>
          ) : null}
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    </>
  );
};

const getItemStyles = createGetStyles2024(({ colors2024 }) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingRight: 0,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    marginLeft: 6,
  },
  arrowText: {
    marginHorizontal: 8,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  innerChainStyle: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-1'],
  },
  sheetContent: {
    // paddingBottom: 16,
    flex: 1,
  },
}));
