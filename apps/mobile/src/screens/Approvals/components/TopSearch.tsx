import { useState, useRef, useCallback } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import { SearchInput } from '@/components/Form/SearchInput';
import { useApprovalsPage } from '../useApprovalsPage';
import { ApprovalsLayouts } from './Layout';

export function TopSearch({
  filterType,
}: {
  filterType: 'contract' | 'assets';
}) {
  const { colors, styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  const formInputRef = useRef<TextInput>(null);
  useInputBlurOnTouchaway(formInputRef);

  const [isInputActive, setIsInputActive] = useState(false);
  const handleInputFocus = useCallback(() => {
    setIsInputActive(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    setIsInputActive(false);
  }, []);

  const { skAssets, skContract, setSearchKw } = useApprovalsPage();

  const searchKw = filterType === 'contract' ? skContract : skAssets;

  return (
    <SearchInput
      isActive={isInputActive}
      containerStyle={styles.searchInputContainer}
      searchIconStyle={styles.searchIconStyle}
      clearable
      inputProps={{
        value: searchKw,
        onChangeText: setSearchKw,
        onFocus: handleInputFocus,
        onBlur: handleInputBlur,
        placeholder: t('page.approvals.search.placeholder', {
          type: filterType === 'contract' ? 'contract' : 'assets',
        }),
        placeholderTextColor: colors['neutral-foot'],
      }}
      // inputStyle={styles.input}
    />
  );
}

const getStyles = createGetStyles(colors => {
  return {
    searchInputContainer: {
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors['neutral-card1'],
      marginVertical: ApprovalsLayouts.searchBarMarginOffset,
      height: ApprovalsLayouts.searchBarHeight,
    },

    searchIconStyle: {
      width: 16,
      height: 16,
    },

    // input: {
    //   backgroundColor: colors['neutral-card1'],
    //   color: colors['neutral-title1'],
    //   width: '100%',
    //   paddingRight: 8,
    //   paddingTop: 12,
    //   paddingHorizontal: 12,
    // },
  };
});
