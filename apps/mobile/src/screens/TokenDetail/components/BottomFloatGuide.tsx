import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import LinearGradient from 'react-native-linear-gradient';
import { TouchableOpacity, View } from 'react-native';
import { BlurShadowView } from '@/components2024/BluerShadow';
import RcIconRightArrowCC from '@/assets2024/icons/copyTrading/IconRrightArrowCC.svg';

interface BottomFloatGuideProps {
  onPress: () => void;
  children: React.ReactNode;
}

const BottomFloatGuide = ({ onPress, children }: BottomFloatGuideProps) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  return (
    <View>
      <LinearGradient
        colors={
          isLight
            ? ['rgba(246, 247, 247, 0.00)', colors2024['neutral-bg-0']]
            : ['rgba(19, 20, 22, 0.00)', colors2024['neutral-bg-1']]
        }
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.floatingBar}>
        <TouchableOpacity onPress={onPress}>
          <BlurShadowView isLight={isLight} blurAmount={10} borderRadius={12}>
            <LinearGradient
              colors={
                isLight
                  ? ['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 1)']
                  : ['rgba(35, 36, 40, 1)', 'rgba(35, 36, 40, 1)']
              }
              locations={[0.009, 0.9864]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={styles.floatingBarButton}>
              <View style={styles.floatingBarContent}>{children}</View>
              <RcIconRightArrowCC
                width={16}
                height={16}
                color={colors2024['neutral-foot']}
              />
            </LinearGradient>
          </BlurShadowView>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

export default BottomFloatGuide;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // height: 123,
    paddingHorizontal: 16,
    paddingTop: 23,
    paddingBottom: 27,
    shadowColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    shadowOffset: {
      width: 0,
      height: -27,
    },
    shadowOpacity: 0.06,
    shadowRadius: 27.5,
    elevation: 27,
  },
  floatingBarButton: {
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-line'],
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  floatingBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
}));
