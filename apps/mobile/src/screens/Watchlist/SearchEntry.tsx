import React from 'react';
import { View, TouchableOpacity, Text, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme2024 } from '@/hooks/theme';
import { RcNextSearchCC } from '@/assets/icons/common';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    left: 8,
    right: 8,
    zIndex: 10,
    width: 'auto',
    elevation: 10,
  },
  gradient: {
    padding: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-line'],
    ...Platform.select({
      ios: {
        shadowColor: isLight ? 'rgba(55, 56, 63, 0.12)' : 'rgba(0, 0, 0, 0.2)',
        shadowOffset: { width: 0, height: isLight ? -6 : -27 },
        shadowOpacity: 1,
        shadowRadius: isLight ? 20 : 13,
      },
      android: {},
    }),
  },
  innerCircle: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isLight
      ? colors2024['neutral-bg-5']
      : colors2024['neutral-bg-3'],
    position: 'relative',
  },
  icon: {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: [{ translateY: -11 }],
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    flex: 1,
    textAlign: 'center',
    color: colors2024['neutral-foot'],
  },
}));

const SearchEntry: React.FC = () => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { navigation } = useSafeSetNavigationOptions();

  const { t } = useTranslation();
  const handlePress = () => {
    navigation.navigate(RootNames.StackHomeNonTab, {
      screen: RootNames.Search,
      params: {},
    });
  };

  return (
    <TouchableOpacity
      style={styles.fabContainer}
      activeOpacity={0.8}
      onPress={handlePress}>
      <LinearGradient
        colors={
          isLight
            ? ['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.4)']
            : ['rgba(35, 36, 40, 0.8)', 'rgba(35, 36, 40, 0.4)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        <View style={styles.innerCircle}>
          <RcNextSearchCC
            width={22}
            height={22}
            style={styles.icon}
            color={colors2024['neutral-body']}
          />
          <Text style={styles.text}>{t('page.watchlist.search.title')}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

export default SearchEntry;
