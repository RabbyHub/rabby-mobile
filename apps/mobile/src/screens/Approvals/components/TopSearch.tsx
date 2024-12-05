import { useRef } from 'react';
import { TextInput } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import { SearchInput } from '@/components/Form/SearchInput';
import { ApprovalsLayouts } from '../layout';

export function TopSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const formInputRef = useRef<TextInput>(null);
  useInputBlurOnTouchaway(formInputRef);

  return (
    <SearchInput
      containerStyle={styles.searchInputContainer}
      searchIconStyle={styles.searchIconStyle}
      clearable
      inputProps={{
        value,
        autoFocus: true,
        onChangeText: onChange,
        placeholder: t('page.approvals.search.placeholder'),
        placeholderTextColor: colors2024['neutral-info'],
      }}
    />
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  searchInputContainer: {
    borderRadius: 30,
    width: 250,
    borderWidth: 0,
    backgroundColor: colors2024['neutral-bg-2'],
    height: ApprovalsLayouts.searchBarHeight,
  },

  searchIconStyle: {
    width: 16,
    height: 16,
  },
}));
