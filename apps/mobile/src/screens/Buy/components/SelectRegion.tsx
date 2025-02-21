import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Image,
  Keyboard,
  ListRenderItem,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import {
  PropsWithChildren,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BottomSheetFlatList,
  BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components';
import React from 'react';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils';
import { useTranslation } from 'react-i18next';
import SearchSVG from '@/assets2024/icons/common/search-cc.svg';
import { SearchInput } from '@/components/Form/SearchInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openapi } from '@/core/request';
import { NotMatchedHolder } from '@/screens/Approvals/components/Layout';
import { BuyCountryItem } from '@rabby-wallet/rabby-api/dist/types';

type TRegionList = Awaited<
  ReturnType<typeof openapi.getBuySupportedCountryList>
>;

const REGION_ITEM_HEIGHT = 64;

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

const SelectRegionInner = ({
  onSelect,
  regionList,
}: {
  onSelect: (s: string) => void;
  regionList: TRegionList;
}) => {
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

  const displayList = useMemo(() => {
    const v = query.trim()?.toLowerCase();
    if (v) {
      return regionList.filter(
        item =>
          item.id?.toLowerCase().includes(v) ||
          item.name?.toLowerCase().includes(v),
      );
    }
    return regionList;
  }, [regionList, query]);

  const renderItem: ListRenderItem<BuyCountryItem> = React.useCallback(
    ({ item }) => (
      <TouchableOpacity
        key={item.id}
        style={styles.item}
        onPress={() => onSelect(item.id)}>
        <Image source={{ uri: item.image_url }} style={styles.flagLogo} />
        <Text style={styles.itemText}>{item.name}</Text>
      </TouchableOpacity>
    ),
    [onSelect, styles.item, styles.flagLogo, styles.itemText],
  );

  const getItemLayout = React.useCallback(
    (_, index) => ({
      length: REGION_ITEM_HEIGHT,
      offset: REGION_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

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
          placeholder: t('page.buy.searchRegionPlaceholder'),
          placeholderTextColor: colors2024['neutral-info'],
        }}
      />

      <BottomSheetFlatList
        contentContainerStyle={
          displayList.length ? styles.flatListContentContainerStyle : {}
        }
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        data={displayList}
        style={styles.flatList}
        ListEmptyComponent={
          <NotMatchedHolder
            style={{
              height: 400,
            }}
            text={t('page.buy.regionBottomSheet.noRegionFound')}
          />
        }
        renderItem={renderItem}
        keyExtractor={item => item.id}
        getItemLayout={getItemLayout}
      />
    </View>
  );
};

export const SelectRegion = ({
  region,
  regionList,
  onSelectRegion,
}: {
  region: string;
  regionList: TRegionList;
  onSelectRegion: (s: string) => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [visible, setVisible] = React.useState(false);

  const regionLogo = React.useMemo(
    () => regionList.find(item => item.id === region)?.image_url,
    [regionList, region],
  );

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
          {regionLogo ? (
            <Image source={{ uri: regionLogo }} style={styles.flagLogo} />
          ) : null}
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
        <SelectRegionInner onSelect={onSelect} regionList={regionList} />
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
    height: REGION_ITEM_HEIGHT,
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
  flagLogo: {
    width: 20,
    height: 20,
    borderRadius: 2,
  },

  flatListContentContainerStyle: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
    borderRadius: 24,
    backgroundColor: colors2024['neutral-bg-1'],
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  flatList: {
    flexShrink: 1,
    // paddingHorizontal: 20,
  },
}));
