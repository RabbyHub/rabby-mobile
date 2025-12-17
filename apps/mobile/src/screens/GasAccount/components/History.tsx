import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Animated,
  Easing,
  ListRenderItem,
  TouchableOpacity,
  Image,
} from 'react-native';
import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import { useTranslation } from 'react-i18next';
import { formatUsdValue } from '@/utils/number';
import { Skeleton } from '@rneui/themed';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcIconHistoryLoading from '@/assets/icons/gas-account/IconHistoryLoading.svg';
import { sinceTime } from '@/utils/time';
import { useGasAccountHistory } from '../hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyHolder } from '@/components/EmptyHolder';
import IconGift from '@/assets2024/icons/home/IconGift.svg';
import { GiftInfoModal } from './GiftInfoModal';
import ImgEmpty from '@/assets2024/images/gasAccount/empty.png';
import ImgEmptyDark from '@/assets2024/images/gasAccount/empty-dark.png';

const HistoryItem = ({
  time,
  isPending = false,
  value = 0,
  sign = '-',
  borderT = false,
  chainServerId,
  txId,
  isWithdraw = false,
  source,
  onGiftIconPress,
}: {
  time: number;
  value: number;
  sign: string;
  className?: string;
  isPending?: boolean;
  borderT?: boolean;
  isWithdraw?: boolean;
  chainServerId?: string;
  txId?: string;
  source?: string;
  onGiftIconPress?: () => void;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const transAnim = React.useRef(new Animated.Value(0));

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(transAnim.current, {
        toValue: 360,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const rotate = transAnim.current.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  // 判断是否显示gift icon
  const showGiftIcon = source === 'gas_account_airdrop';

  return (
    <TouchableOpacity
      onPress={showGiftIcon ? onGiftIconPress : undefined}
      style={[
        styles.historyItem,
        borderT && styles.borderTop,
        isPending && { height: 64 },
      ]}>
      <View style={styles.leftContainer}>
        {isPending ? (
          <View style={styles.pendingContainer}>
            <Animated.View
              style={{
                ...styles.pendingIcon,
                transform: [
                  {
                    rotate,
                  },
                ],
              }}>
              <RcIconHistoryLoading width={16} height={16} />
            </Animated.View>

            <Text style={styles.pendingText}>
              {isWithdraw
                ? t('page.gasAccount.withdraw')
                : t('page.gasAccount.deposit')}
            </Text>
          </View>
        ) : (
          <Text style={styles.timeText}>{sinceTime(time)}</Text>
        )}
      </View>
      {showGiftIcon && (
        <TouchableOpacity
          style={styles.giftIconContainer}
          activeOpacity={0.7}
          onPress={onGiftIconPress}>
          <IconGift width={18} height={18} />
        </TouchableOpacity>
      )}
      <Text style={styles.valueText}>
        {sign}
        {formatUsdValue(value)}
      </Text>
    </TouchableOpacity>
  );
};

const LoadingItem = ({ borderT }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={[styles.historyItem, borderT && styles.borderTop]}>
      <Skeleton width={68} height={16} style={styles.skeletonStyle} />
      <Skeleton width={68} height={16} style={styles.skeletonStyle} />
    </View>
  );
};

export const GasAccountHistory = () => {
  const { t } = useTranslation();
  const { loading, txList, loadingMore, loadMore, noMore } =
    useGasAccountHistory();
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const [isModalVisible, setIsModalVisible] = useState(false);

  const { bottom } = useSafeAreaInsets();

  const handleGiftIconPress = useCallback(() => {
    console.log('Gift icon pressed!');
    setIsModalVisible(true);
  }, []);

  const handleCloseGiftInfo = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  const ListEmptyComponent = useMemo(
    () =>
      loading ? (
        <>
          {Array.from({ length: 10 }).map((_, idx) => (
            <LoadingItem key={idx} borderT={idx !== 0} />
          ))}
        </>
      ) : null,
    [loading],
  );

  const ListEndLoader = useCallback(() => {
    if (noMore) {
      return null;
    }
    return <LoadingItem borderT />;
  }, [noMore]);

  const ListHeaderComponent = useCallback(() => {
    return (
      <>
        {!loading &&
          txList?.withdrawList?.map((item, index) => {
            // 从txList.list中查找对应的item来获取source字段
            const sourceItem = txList?.list?.find(
              listItem =>
                listItem.tx_id === item.tx_id &&
                listItem.chain_id === item.chain_id,
            );
            return (
              <HistoryItem
                isWithdraw={true}
                key={item.create_at}
                time={item.create_at}
                value={item.amount}
                sign={'-'}
                borderT={!txList.rechargeList.length ? index !== 0 : true}
                isPending={true}
                chainServerId={item?.chain_id}
                txId={item?.tx_id}
                source={sourceItem?.source}
                onGiftIconPress={handleGiftIconPress}
              />
            );
          })}
        {!loading &&
          txList?.rechargeList?.map((item, index) => {
            // 从txList.list中查找对应的item来获取source字段
            const sourceItem = txList?.list?.find(
              listItem =>
                listItem.tx_id === item.tx_id &&
                listItem.chain_id === item.chain_id,
            );
            return (
              <HistoryItem
                key={item.tx_id + item.chain_id}
                time={item.create_at}
                value={item.amount}
                sign={'+'}
                borderT={
                  !txList?.rechargeList.length && !txList?.withdrawList.length
                    ? index !== 0
                    : true
                }
                isPending={true}
                chainServerId={item?.chain_id}
                txId={item?.tx_id}
                source={sourceItem?.source}
                onGiftIconPress={handleGiftIconPress}
              />
            );
          })}
      </>
    );
  }, [
    loading,
    txList?.rechargeList,
    txList?.withdrawList,
    txList?.list,
    handleGiftIconPress,
  ]);

  const renderItem: ListRenderItem<{
    id: string;
    chain_id: string;
    create_at: number;
    gas_cost_usd_value: number;
    gas_account_id: string;
    tx_id: string;
    usd_value: number;
    user_addr: string;
    history_type: 'tx' | 'recharge' | 'withdraw';
    source?: string;
  }> = useCallback(
    ({ item, index }) => (
      <HistoryItem
        key={item.tx_id + item.chain_id}
        time={item.create_at}
        value={item.usd_value}
        sign={item.history_type === 'recharge' ? '+' : '-'}
        borderT={!txList?.rechargeList.length ? index !== 0 : true}
        source={item.source}
        onGiftIconPress={handleGiftIconPress}
      />
    ),
    [txList?.rechargeList, handleGiftIconPress],
  );

  if (
    !loading &&
    !txList?.rechargeList.length &&
    !txList?.withdrawList.length &&
    !txList?.list.length
  ) {
    return (
      <View
        style={[
          styles.container,
          { height: 254 },
          isLight ? styles.containerLight : styles.containerDark,
        ]}>
        <View style={styles.emptyContent}>
          <Image
            source={isLight ? ImgEmpty : ImgEmptyDark}
            style={styles.emptyImg}
            resizeMode="contain"
          />
          <Text style={styles.emptyText}>
            {t('page.gasAccount.history.noHistory')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={[
          styles.container,
          { marginBottom: bottom },
          isLight ? styles.containerLight : styles.containerDark,
        ]}
        data={txList?.list}
        contentInset={{ bottom: 12 }}
        ListHeaderComponent={ListHeaderComponent}
        renderItem={renderItem}
        extraData={txList?.rechargeList.length}
        keyExtractor={item =>
          `${item.tx_id}-${item.chain_id}-${item.id || item.user_addr}-${
            item.create_at
          }`
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={ListEndLoader}
        ListEmptyComponent={ListEmptyComponent}
      />
      <GiftInfoModal
        visible={isModalVisible}
        snapPoints={[209]}
        header={
          <View style={styles.giftInfoHeader}>
            <IconGift width={18} height={18} />
            <Text style={styles.giftInfoHeaderText}>
              {t('component.gasAccount.giftInfo.giftTips')}
            </Text>
          </View>
        }
        onClose={handleCloseGiftInfo}
      />
    </>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  containerLight: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  containerDark: {
    backgroundColor: colors2024['neutral-bg-2'],
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors2024['orange-light-1'],
    borderRadius: 100,
    padding: 10,
    borderWidth: 1,
    borderColor: colors2024['orange-light-2'],
  },
  pendingIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  pendingText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 19.73,
    letterSpacing: 0.447,
    color: colors2024['orange-default'],
  },
  externalIcon: {
    width: 12,
    height: 12,
  },
  timeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  valueText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
    color: colors2024['neutral-title-1'],
  },
  giftInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '800',
    lineHeight: 24,
  },
  giftInfoHeaderText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  // loadingItem: {
  //   paddingHorizontal: 20,
  //   height: 50,

  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   paddingVertical: 12,
  // },
  skeletonStyle: {
    height: 16,
    borderRadius: 4,
    width: 68,
  },
  borderTop: {
    // borderTopWidth: 0.5,
    // borderTopColor: colors['neutral-card2'],
  },

  emptyImg: {
    marginTop: 36,
    width: 163,
    height: 126,
  },

  emptyContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },

  emptyText: {
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 20,
  },

  skeletonBlock: {
    width: '100%',
    height: 210,
    padding: 0,
    borderRadius: 6,
    marginBottom: 12,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  giftIconContainer: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
