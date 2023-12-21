import { useThemeColors } from '@/hooks/theme';
import { memo } from 'react';
import ContentLoader, { Rect } from 'react-content-loader/native';
import { Dimensions, View } from 'react-native';

const detailWidth = (Dimensions.get('window').width - 50) / 2;

export const HeaderLoader = (props: any) => {
  const colors = useThemeColors();
  return (
    <ContentLoader
      speed={2}
      width={'100%'}
      height={43.7}
      viewBox="0 0 390 43.7"
      backgroundColor={colors['neutral-bg-1']}
      backgroundOpacity={0.5}
      foregroundOpacity={0.5}
      foregroundColor={colors['neutral-line']}
      {...props}>
      <Rect x="0" y="22" rx="3" ry="3" width="390" height="21.7" />
    </ContentLoader>
  );
};
export const CardLoader = (props: any) => {
  const colors = useThemeColors();
  return (
    <ContentLoader
      speed={2}
      width={detailWidth}
      height={detailWidth}
      viewBox={`0 0 ${detailWidth} ${detailWidth}`}
      backgroundColor={colors['neutral-bg-1']}
      backgroundOpacity={0.5}
      foregroundOpacity={0.5}
      foregroundColor={colors['neutral-line']}
      {...props}>
      <Rect
        x="0"
        y="0"
        rx="3"
        ry="3"
        width={detailWidth}
        height={detailWidth}
      />
    </ContentLoader>
  );
};

export const NFTListLoader = memo(() => (
  <View style={{ flex: 1, width: '100%', paddingHorizontal: 20 }}>
    {Array(5)
      .fill(0)
      .map((e, i) => (
        <View key={i}>
          <HeaderLoader />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 10,
            }}>
            <CardLoader />
            <CardLoader />
          </View>
        </View>
      ))}
  </View>
));
