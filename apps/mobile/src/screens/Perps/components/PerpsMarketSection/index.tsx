import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { RcNextSearchCC } from '@/assets/icons/common';
import { usePerpsPopupState } from '../../hooks/usePerpsPopupState';

// Export header component separately for use in main FlatList
export const PerpsMarketSectionHeader: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const [_popupState, setPopupState] = usePerpsPopupState();

  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{t('page.perps.explorePerps')}</Text>
      <TouchableOpacity
        style={styles.sectionAction}
        onPress={() => {
          setPopupState(prev => ({
            ...prev,
            isShowSearchListPopup: true,
            searchListOpenFrom: 'searchPerps',
          }));
        }}>
        <RcNextSearchCC
          color={colors2024['neutral-secondary']}
          width={20}
          height={20}
        />
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {},
  footer: {
    height: 56,
    width: '100%',
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  sectionTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  sectionAction: {
    paddingHorizontal: 4,
  },
  sectionActionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    textAlign: 'right',
  },
  sectionActionIcon: {
    width: 16,
    height: 16,
    marginLeft: 4,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  itemSeparator: {
    height: 8,
  },
}));
