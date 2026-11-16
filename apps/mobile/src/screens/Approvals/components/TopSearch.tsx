import { useRef } from 'react';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import { SearchInput } from '@/components/Form/SearchInput';
import { ApprovalsLayouts } from '../layout';
import { TextInput } from '@/components/Typography';
import { IS_ANDROID } from '@/core/native/utils';

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
      inputStyle={styles.inputStyle}
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
  inputStyle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 17,
    flex: 1,
    color: colors2024['neutral-body'],
    // Let the fixed-height pill centre the single-line input by its own font
    // metrics. Setting an explicit input height made the iOS placeholder sit a
    // few points below the icon once the field gained focus.
    includeFontPadding: false,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  searchInputContainer: {
    flex: 1,
    // The trailing bar item is a text "Cancel" on Android, which is wider than
    // the search icon it replaces. Keep a little breathing room so the rounded
    // field never touches it.
    marginRight: IS_ANDROID ? 8 : 0,
    borderRadius: 30,
    borderWidth: 0,
    backgroundColor: colors2024['neutral-bg-2'],
    height: ApprovalsLayouts.searchBarHeight,
  },

  searchIconStyle: {
    width: 16,
    height: 16,
  },
}));
