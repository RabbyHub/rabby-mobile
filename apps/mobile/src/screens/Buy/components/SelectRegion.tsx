import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, TouchableOpacity, View } from 'react-native';
import IconUSLogo from '@/assets2024/icons/buy/us.svg';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import {
  PropsWithChildren,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  BottomSheetModalProps,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components';
import React from 'react';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils';
import { useTranslation } from 'react-i18next';
import SearchSVG from '@/assets2024/icons/common/search-cc.svg';
import { SearchInput } from '@/components/Form/SearchInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const list = [
  {
    logo: IconUSLogo,
    name: 'us',
    defaultPay: 'USD',
    label: 'United States',
  },
];

const BottomSheetWrapper = (
  props: PropsWithChildren<
    {
      visible: boolean;
      onClose: () => void;
    } & BottomSheetModalProps
  >,
) => {
  const { visible, onClose, children, ...others } = props;

  const modalRef = useRef<AppBottomSheetModal>(null);

  useLayoutEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);
  return (
    <AppBottomSheetModal
      snapPoints={['90%']}
      onDismiss={onClose}
      ref={modalRef}
      {...others}>
      {children}
    </AppBottomSheetModal>
  );
};

const SelectRegionInner = ({ onSelect }: { onSelect: (s: string) => void }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [isInputActive, setIsInputActive] = useState(false);
  const [query, setQuery] = useState('');

  const { bottom } = useSafeAreaInsets();

  const handleInputFocus = () => {
    setIsInputActive(true);
  };

  const handleInputBlur = () => {
    setIsInputActive(false);
  };

  return (
    <View style={styles.innerContainer}>
      <Text style={styles.title}>{t('page.buy.regionBottomSheet.title')}</Text>
      <SearchInput
        isActive={isInputActive}
        containerStyle={styles.searchInputContainer}
        searchIconWrapperStyle={styles.searchIconWrapperStyle}
        inputStyle={styles.inputStyle}
        searchIcon={<SearchSVG color={colors2024['neutral-foot']} />}
        inputProps={{
          value: query,
          onChange: e => setQuery(e.nativeEvent.text),
          onFocus: handleInputFocus,
          onBlur: handleInputBlur,
          placeholder: 'Search Token',
          placeholderTextColor: colors2024['neutral-info'],
        }}
      />

      <BottomSheetScrollView style={[styles.list, { marginBottom: bottom }]}>
        {list.map(item => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => onSelect(item.name)}>
            <item.logo width={24} height={24} />
            <Text style={styles.itemText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </BottomSheetScrollView>
    </View>
  );
};

export const SelectRegion = ({
  region,
  onSelectRegion,
}: {
  region: string;
  onSelectRegion: (s: string) => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [visible, setVisible] = React.useState(false);

  const onSelect = React.useCallback(
    (s: string) => {
      onSelectRegion(s);
      setVisible(false);
    },
    [onSelectRegion],
  );

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={styles.container}>
        <View style={styles.inner}>
          <IconUSLogo width={24} height={24} />
          <RcIconSwapBottomArrow />
        </View>
      </TouchableOpacity>

      <BottomSheetWrapper
        visible={visible}
        onClose={() => {
          setVisible(false);
        }}
        {...makeBottomSheetProps({
          linearGradientType: 'linear',
          colors: colors2024,
        })}>
        <SelectRegionInner onSelect={onSelect} />
      </BottomSheetWrapper>
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  inner: {
    marginTop: 20,
    backgroundColor: colors2024['neutral-bg-1'],
    padding: 4,
    paddingLeft: 12,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
  },
  innerContainer: {
    paddingHorizontal: 16,
    flex: 1,
  },

  title: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 24,
    marginVertical: 24,
  },

  scroll: { flex: 1 },

  searchInputContainer: {
    borderRadius: 30,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 12,
    borderColor: 'transparent',
    alignItems: 'center',
    marginBottom: 16,
  },

  searchIconWrapperStyle: {
    paddingLeft: 0,
  },

  inputStyle: {
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
    fontSize: 17,
    color: colors2024['neutral-title-1'],
  },

  list: {
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
    paddingHorizontal: 24,
    flex: 0,
  },

  item: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  itemText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
}));
