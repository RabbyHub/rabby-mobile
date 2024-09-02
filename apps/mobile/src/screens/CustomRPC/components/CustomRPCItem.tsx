import RcIconDelete from '@/assets/icons/custom-testnet/delete-cc.svg';
import RcIconEdit from '@/assets/icons/custom-testnet/edit-cc.svg';
import { AppSwitch } from '@/components';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { CHAINS_ENUM } from '@/constant/chains';
import { AppColorsVariants } from '@/constant/theme';
import { RPCItem } from '@/core/services/customRPCService';
import { useThemeColors } from '@/hooks/theme';
import { findChainByEnum } from '@/utils/chain';
import { useMemoizedFn } from 'ahooks';
import { EventEmitter } from 'ahooks/lib/useEventEmitter';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  RectButton,
  Swipeable,
  TouchableOpacity,
} from 'react-native-gesture-handler';

type RPCItemInfo = { id: CHAINS_ENUM; rpc: RPCItem };

export const CustomRPCItem = ({
  style,
  containerStyle,
  item,
  onEdit,
  onRemove,
  onPress,
  onEnabled,
  close$,
}: {
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  item: RPCItemInfo;
  onEdit?: (item: RPCItemInfo) => void;
  onRemove?: (item: RPCItemInfo) => void;
  onEnabled?: (v: boolean, item: RPCItemInfo) => void;
  onPress?: (item: RPCItemInfo) => void;
  close$?: EventEmitter<void>;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { t } = useTranslation();

  const swipeRef = useRef<any>(null);

  close$?.useSubscription(() => {
    swipeRef.current?.close();
  });

  const chainItem = useMemo(() => {
    return findChainByEnum(item.id);
  }, [item?.id]);

  const renderRightActions = useMemoizedFn(
    (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      const trans = [128, 64].map(x => {
        return progress.interpolate({
          inputRange: [0, 1],
          outputRange: [x, 0],
        });
      });

      return (
        <Animated.View
          style={[
            styles.actionContainer,
            // eslint-disable-next-line react-native/no-inline-styles
            {
              width: 128,
            },
          ]}>
          <Animated.View
            style={{
              transform: [{ translateX: trans[0] }],
            }}>
            <RectButton
              style={[styles.action, styles.actionEdit]}
              onPress={() => {
                onEdit?.(item);
              }}>
              <RcIconEdit color={colors['neutral-title-2']} />
            </RectButton>
          </Animated.View>

          <Animated.View
            style={{
              transform: [{ translateX: trans[1] }],
            }}>
            <RectButton
              style={[styles.action, styles.actionDelete]}
              onPress={() => {
                onRemove?.(item);
              }}>
              <RcIconDelete color={colors['neutral-title-2']} />
            </RectButton>
          </Animated.View>
        </Animated.View>
      );
    },
  );

  const Content = (
    <View style={[styles.item, style]}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={{ width: '100%' }}
          onPress={() => {
            onPress?.(item);
          }}>
          <View style={styles.mainContent}>
            <ChainIconImage chainEnum={item.id} size={32} />
            <View style={styles.content}>
              <Text style={styles.name}>{chainItem?.name}</Text>
              <View style={styles.footer}>
                <Text style={styles.url}>{item.rpc?.url}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.left}>
        <AppSwitch
          circleSize={20}
          value={!!item.rpc?.enable}
          changeValueImmediately={false}
          onValueChange={() => {
            onEnabled?.(!item.rpc?.enable, item);
          }}
          backgroundActive={colors['green-default']}
          circleBorderActiveColor={colors['green-default']}
        />
      </View>
    </View>
  );
  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={[styles.swipeContainer, containerStyle]}>
      {Content}
    </Swipeable>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    item: {
      flexDirection: 'row',
      borderRadius: 8,
      backgroundColor: colors['neutral-card-1'],
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      alignItems: 'center',
    },
    mainContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    left: {
      marginLeft: 'auto',
    },
    logo: {
      width: 32,
      height: 32,
    },
    content: {
      minWidth: 0,
      flex: 1,
    },
    name: {
      fontSize: 16,
      lineHeight: 19,
      color: colors['neutral-title-1'],
      fontWeight: '500',
      marginBottom: 4,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    url: {
      fontSize: 13,
      lineHeight: 16,
      color: colors['neutral-foot'],
    },
    infoValue: {
      color: colors['neutral-body'],
    },

    swipeContainer: {
      borderRadius: 8,
    },
    actionContainer: {
      flexDirection: 'row',
      width: 128,
      alignItems: 'stretch',
    },
    action: {
      paddingHorizontal: 20,
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    },
    actionEdit: {
      backgroundColor: colors['blue-default'],
    },
    actionDelete: {
      backgroundColor: colors['red-default'],
    },
  });
