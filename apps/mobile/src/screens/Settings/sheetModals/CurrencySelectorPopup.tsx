import { atom, useAtom } from 'jotai';
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, Text, useWindowDimensions, View } from 'react-native';

import { RcIconCheckmarkCC, RcNextSearchCC } from '@/assets/icons/common';

import { AppBottomSheetModal } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  NextSearchBar,
  NextSearchBarMethods,
} from '@/components2024/SearchBar';
import { useTheme2024 } from '@/hooks/theme';
import { useCurrency } from '@/hooks/useCurrency';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import FastImage from 'react-native-fast-image';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { sortBy, uniq } from 'lodash';
import { CurrencyItem } from '@rabby-wallet/rabby-api/dist/types';

const visibleAtom = atom(false);
export function useCurrentCurrencyVisible() {
  const [isShowCurrencyPopup, setIsShowCurrencyPopup] = useAtom(visibleAtom);
  const { currency } = useCurrency();

  return {
    currency,
    isShowCurrencyPopup,
    setIsShowCurrencyPopup,
  };
}

export function CurrencySelectorPopup({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { currencyStore, currency, setCurrentCurrency } = useCurrency();
  const { isShowCurrencyPopup: visible, setIsShowCurrencyPopup } =
    useCurrentCurrencyVisible();

  const handleCancel = useCallback(() => {
    setIsShowCurrencyPopup(false);
    onCancel?.();
  }, [setIsShowCurrencyPopup, onCancel]);

  const searchRef = useRef<NextSearchBarMethods>(null);
  const [isFocus, setIsFocus] = useState(false);
  const [searchText, setSearchText] = useState('');

  const isShowFakePlaceholder = !searchText && !isFocus;

  const deferredSearchText = useDeferredValue(searchText);

  const sortedList = useMemo(() => {
    const topList = uniq([currency.code, 'USD', 'EUR']);

    return [
      ...topList.map(code => {
        return currencyStore.currencyList.find(item => {
          return item.code === code;
        });
      }),
      ...sortBy(
        currencyStore.currencyList.filter(item => !topList.includes(item.code)),
        item => {
          return item.code;
        },
      ),
    ].filter(Boolean) as CurrencyItem[];
  }, [currency.code, currencyStore.currencyList]);

  const list = useMemo(() => {
    if (!deferredSearchText.trim()) {
      return sortedList;
    }
    return sortedList.filter(item => {
      return (
        item.code.toLowerCase().includes(deferredSearchText.toLowerCase()) ||
        item.symbol.toLowerCase().includes(deferredSearchText.toLowerCase())
      );
    });
  }, [deferredSearchText, sortedList]);

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
      setIsFocus(false);
      setSearchText('');
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={[maxHeight]}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      onDismiss={handleCancel}
      enableContentPanningGesture={true}>
      <AutoLockView as="View" style={[styles.container]}>
        <View>
          <Text style={styles.title}>{t('page.setting.currency')}</Text>
          <View style={styles.searchContainer}>
            {isShowFakePlaceholder ? (
              <View>
                <TouchableWithoutFeedback
                  onPress={() => {
                    searchRef.current?.focus();
                  }}>
                  <View style={styles.fakePlaceholder}>
                    <RcNextSearchCC
                      color={colors2024['neutral-secondary']}
                      width={16}
                      height={16}
                    />
                    <Text style={styles.placeholder}>
                      {t('page.setting.searchCurrency')}
                    </Text>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            ) : null}
            <NextSearchBar
              ref={searchRef}
              value={searchText}
              onChangeText={setSearchText}
              onBlur={() => {
                setIsFocus(false);
              }}
              style={isShowFakePlaceholder ? styles.hidden : null}
              onFocus={() => {
                setIsFocus(true);
              }}
              placeholder={t('page.setting.searchCurrency')}
            />
          </View>
        </View>
        <BottomSheetScrollView
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          onStartShouldSetResponder={() => {
            Keyboard.dismiss();
            return false;
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}>
          {list.map((item, idx) => {
            const isSelected = currency.code === item.code;

            return (
              <TouchableOpacity
                key={item.code}
                onPress={() => {
                  setCurrentCurrency(item.code);
                  setIsShowCurrencyPopup(false);
                }}>
                <View style={styles.listItem}>
                  <FastImage
                    style={styles.icon}
                    source={{
                      uri: item.logo_url,
                    }}
                  />
                  <Text style={styles.label}>
                    {item.code} ({item.symbol})
                  </Text>
                  {isSelected ? (
                    <View style={styles.extra}>
                      <RcIconCheckmarkCC color={colors['green-default']} />
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </BottomSheetScrollView>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      paddingHorizontal: 16,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      textAlign: 'center',
      marginBottom: 14,
    },
    searchContainer: {
      marginBottom: 14,
      position: 'relative',
    },
    fakePlaceholder: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: colors2024['neutral-bg-5'],
      borderRadius: 12,
      padding: 13,
    },
    placeholder: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
    },

    list: {
      width: '100%',
      paddingBottom: 56,
      flex: 1,
    },
    listContent: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      paddingBottom: 56,
    },
    listItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      paddingVertical: 20,
      paddingHorizontal: 24,

      width: '100%',
    },

    icon: {
      width: 32,
      height: 32,
      borderRadius: 10000,
    },

    label: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    extra: {
      marginLeft: 'auto',
    },

    hidden: {
      display: 'none',
    },
  };
});
