import { memo } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import ContentLoader, { Rect, Circle } from 'react-content-loader/native';
import { useThemeColors } from '@/hooks/theme';

export const AvatarLoader = (props: any) => {
  const colors = useThemeColors();
  return (
    <ContentLoader
      speed={2}
      width={175}
      height={100}
      viewBox="0 0 175 100"
      backgroundColor={colors['neutral-bg-1']}
      backgroundOpacity={0.1}
      foregroundOpacity={0.1}
      foregroundColor={colors['neutral-line']}
      {...props}>
      <Rect x="42" y="34" rx="1" ry="1" width="42" height="13" />
      <Rect x="42" y="50" rx="1" ry="1" width="78" height="10" />
      <Circle cx="16" cy="46" r="16" />
    </ContentLoader>
  );
};

export const PositionLoader = ({ space }: { space: number }) => {
  const colors = useThemeColors();

  return (
    <>
      {[...Array(6)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.positionLoader,
            // eslint-disable-next-line react-native/no-inline-styles
            {
              backgroundColor: 'white',
              borderTopColor: colors['neutral-line'],
              marginBottom: space,
              borderTopWidth: space ? 0 : StyleSheet.hairlineWidth,
            },
          ]}>
          <ContentLoader
            speed={2}
            viewBox="0 0 335 60"
            width="100%"
            height={60}
            backgroundColor={colors['neutral-bg-1']}
            // backgroundOpacity={0.1}
            // foregroundOpacity={0.1}
            foregroundColor={colors['neutral-line']}>
            <Circle cx="26" cy="30" r="14" />
            <Rect x="52" y="31" width="51" height="17" rx="2" />
            <Rect x="52" y="12" width="144" height="17" rx="2" />
          </ContentLoader>
        </View>
      ))}
    </>
  );
};

export const NetWorthLoader = memo(() => {
  const colors = useThemeColors();
  const isLight = useColorScheme() === 'light';
  return (
    <ContentLoader
      speed={2}
      width={110}
      height={30}
      viewBox="0 0 110 30"
      backgroundColor={
        isLight ? colors['blue-light-1'] : colors['neutral-bg-1']
      }
      foregroundColor={colors['neutral-line']}>
      <Rect x="0" y="0" rx="2" ry="2" width="110" height="30" />
    </ContentLoader>
  );
});

export const ChangeLoader = memo(() => {
  const colors = useThemeColors();
  const isLight = useColorScheme() === 'light';
  return (
    <ContentLoader
      speed={2}
      width={150}
      height={22}
      viewBox="0 0 150 22"
      backgroundColor={
        isLight ? colors['blue-light-1'] : colors['neutral-bg-1']
      }
      foregroundColor={colors['neutral-line']}>
      <Rect x="0" y="6" rx="1" ry="1" width="150" height="16" />
    </ContentLoader>
  );
});

export const GasLoader = (props: any) => {
  const colors = useThemeColors();
  const isLight = useColorScheme() === 'light';

  return (
    <ContentLoader
      speed={2}
      width={375}
      height={40}
      viewBox="0 0 375 40"
      backgroundColor={
        isLight ? colors['blue-light-1'] : colors['neutral-bg-1']
      }
      foregroundColor={colors['neutral-line']}
      {...props}>
      <Rect x="0" y="25" rx="1" ry="1" width="235" height="14" />
    </ContentLoader>
  );
};

export const ItemChangeLoader = memo(() => {
  const colors = useThemeColors();
  return (
    <ContentLoader
      speed={2}
      width={88}
      height={14}
      viewBox="0 0 88 14"
      backgroundColor={colors['neutral-bg-1']}
      // backgroundOpacity={0.1}
      // foregroundOpacity={0.1}
      foregroundColor={colors['neutral-line']}>
      <Rect x="0" y="0" rx="1" ry="1" width="88" height="14" />
    </ContentLoader>
  );
});

const styles = StyleSheet.create({
  positionLoader: {
    height: 60,
    alignItems: 'center',
    borderRadius: 4,
  },
});
