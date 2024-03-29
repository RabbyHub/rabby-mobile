import { useState, useRef, useCallback } from 'react';
import { TextInput } from 'react-native';
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import { SearchInput } from '@/components/Form/SearchInput';
import { useApprovalsPage } from '../useApprovalsPage';

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

  const { setSearchKw } = useApprovalsPage();

  return (
    <SearchInput
      isActive={isInputActive}
      containerStyle={styles.searchInputContainer}
      searchIconStyle={styles.searchIconStyle}
      inputProps={{
        // value: query,
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
      backgroundColor: colors['neutral-card1'],
      marginVertical: 16,
      height: 48,
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
