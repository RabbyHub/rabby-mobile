import { RcArrowRightCC } from '@/assets/icons/common';
import TouchableView from '@/components/Touchable/TouchableView';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';

export const makeNoop = () => () => {};

type ItOrItsPromise<T> = T | Promise<T>;

type GenerateNodeCtx = {};
type PressResult = void | {
  keepModalVisible?: boolean;
};
export type DevTestItem = {
  disabled?: boolean;
  visible?: boolean;
  label: string;
  icon?: /* ((ctx: GenerateNodeCtx) => React.ReactNode) |  */ React.ReactNode;
  rightNode?: React.ReactNode | ((ctx?: GenerateNodeCtx) => React.ReactNode);
  onPress?: () => ItOrItsPromise<PressResult>;
  onDisabledPress?: () => ItOrItsPromise<PressResult>;
};

export function GeneralTestItem({
  children = null,
  itemIndex = 0,
  afterPress,
  ...item
}: React.PropsWithChildren<
  DevTestItem & {
    itemIndex?: number;
    afterPress?: (ctx: PressResult) => void;
  }
>) {
  const { styles, colors } = useTheme2024({ getStyle });

  const rightNode =
    typeof item.rightNode === 'function' ? item.rightNode() : item.rightNode;

  return (
    <TouchableView
      style={[
        styles.settingItem,
        itemIndex > 0 && styles.notFirstOne,
        { opacity: item.disabled ? 0.6 : 1 },
      ]}
      disabled={item.disabled ? !item.onDisabledPress : !item.onPress}
      onPress={async () => {
        const result = await (item.disabled
          ? item.onDisabledPress
          : item.onPress)?.();

        afterPress?.(result);
      }}>
      {children || (
        <>
          <View style={styles.leftCol}>
            <View style={styles.iconWrapper}>{item.icon}</View>
            <Text style={styles.settingItemLabel}>{item.label}</Text>
          </View>
          {rightNode || <RcArrowRightCC color={colors['neutral-foot']} />}
        </>
      )}
    </TouchableView>
  );
}

const SIZES = {
  ITEM_HEIGHT: 60,
  ITEM_GAP: 12,
};

const getStyle = createGetStyles2024(ctx => {
  return {
    settingItem: {
      width: '100%',
      height: SIZES.ITEM_HEIGHT,
      paddingTop: 18,
      paddingBottom: 18,
      paddingHorizontal: 12,
      backgroundColor: !ctx?.isLight
        ? ctx.colors['neutral-card1']
        : ctx.colors['neutral-bg1'],
      borderRadius: 8,

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    notFirstOne: {
      marginTop: SIZES.ITEM_GAP,
    },
    leftCol: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    labelIcon: { width: 18, height: 18 },
    iconWrapper: {
      width: 18,
      height: 18,
      marginRight: 8,
    },
    settingItemLabel: {
      color: ctx.colors['neutral-title-1'],
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
    },
  };
});
