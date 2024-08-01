import RcIconDelete from '@/assets/icons/custom-testnet/delete-cc.svg';
import RcIconEdit from '@/assets/icons/custom-testnet/edit-cc.svg';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { AppColorsVariants } from '@/constant/theme';
import { TestnetChain } from '@/core/services/customTestnetService';
import { useThemeColors } from '@/hooks/theme';
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

export const CustomTestnetItem = ({
  style,
  containerStyle,
  item,
  onEdit,
  onRemove,
  onPress,
  editable,
  disabled,
  close$,
}: {
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  item: TestnetChain;
  onEdit?: (item: TestnetChain) => void;
  onRemove?: (item: TestnetChain) => void;
  onPress?: (item: TestnetChain) => void;
  editable?: boolean;
  disabled?: boolean;
  close$?: EventEmitter<void>;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { t } = useTranslation();

  const swipeRef = useRef<any>(null);

  close$?.useSubscription(() => {
    swipeRef.current?.close();
  });

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
    <TouchableOpacity
      onPress={() => {
        onPress?.(item);
      }}>
      <View
        style={[
          styles.item,
          editable
            ? {
                borderRadius: 0,
              }
            : null,
          style,
        ]}>
        <TestnetChainLogo name={item.name} size={32} />
        <View style={styles.content}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.footer}>
            <Text style={styles.info}>
              {t('page.customTestnet.currency')}:{' '}
              <Text style={styles.infoValue}>{item.nativeTokenSymbol}</Text>
            </Text>
            <Text style={styles.info}>
              {t('page.customTestnet.id')}:{' '}
              <Text style={styles.infoValue}>{item.id}</Text>
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
  if (editable) {
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
  } else {
    return Content;
  }
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
    info: {
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
