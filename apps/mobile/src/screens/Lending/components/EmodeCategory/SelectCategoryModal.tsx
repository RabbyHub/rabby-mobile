import React, { useCallback, useMemo } from 'react';

import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Keyboard, Text, View } from 'react-native';

import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

import CategoryItem from './CategoryItem';
import { EmodeCategory } from '../../type';
import { useMode } from '../../hooks/useMode';
import { useLendingISummary } from '../../hooks';
import { isEModeCategoryAvailable } from '../../utils/emode';

export type EModeCategoryDisplay = EmodeCategory & {
  available: boolean; // indicates if the user can enter this category
};

interface IProps {
  value?: number;
  /** @deprecated */
  titleText?: string;
  onChange: (categoryId: number) => void;
}
const FOOTER_COMPONENT_HEIGHT = 32;
export default function SelectCategoryModal({ value, onChange }: IProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { iUserSummary } = useLendingISummary();
  const { eModes } = useMode();
  const eModeCategories: Record<number, EModeCategoryDisplay> = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(eModes).map(([key, _value]) => [
          key,
          {
            ..._value,
            available: iUserSummary
              ? isEModeCategoryAvailable(iUserSummary, _value)
              : false,
          },
        ]),
      ),
    [eModes, iUserSummary],
  );
  const sortedEModeCategories = useMemo(() => {
    return Object.values(eModeCategories)
      .filter(emode => emode.id !== 0 && emode.label !== 'USYC GHO')
      .sort((a, b) => {
        if (a.available !== b.available) {
          return a.available ? -1 : 1;
        }

        return a.id - b.id;
      });
  }, [eModeCategories]);

  const isDark = useGetBinaryMode() === 'dark';

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>
          {t('page.Lending.manageEmode.categorySelector.header.asset')}
        </Text>
        <Text style={styles.headerText}>{t('page.Lending.maxLtv')}</Text>
      </View>
    );
  }, [styles.headerContainer, styles.headerText, t]);

  return (
    <AutoLockView
      style={{
        ...styles.container,
        backgroundColor: isDark
          ? colors2024['neutral-bg-1']
          : colors2024['neutral-bg-0'],
      }}>
      <BottomSheetHandlableView>
        <View style={{ ...styles.titleView, ...styles.titleViewWithText }}>
          <View style={styles.titleTextWrapper}>
            <Text style={styles.titleText}>
              {t('page.Lending.manageEmode.categorySelector.label')}
            </Text>
          </View>
        </View>
      </BottomSheetHandlableView>

      <View style={[styles.chainListWrapper]}>
        <BottomSheetFlatList<EModeCategoryDisplay>
          data={sortedEModeCategories}
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
          }}
          style={styles.flatList}
          ListFooterComponent={
            <View style={{ height: FOOTER_COMPONENT_HEIGHT }} />
          }
          ListHeaderComponent={ListHeaderComponent}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item, index }) => {
            const isSectionFirst = index === 0;
            const isSectionLast =
              index === (Object.values(eModes)?.length || 0) - 1;
            return (
              <View
                style={[
                  isSectionFirst && styles.sectionFirst,
                  isSectionLast && styles.sectionLast,
                ]}>
                <CategoryItem
                  title={item.label}
                  available={item.available}
                  ltv={item.ltv}
                  isSelected={item.id === value}
                  onPress={() => onChange(item.id)}
                />
              </View>
            );
          }}
        />
      </View>
    </AutoLockView>
  );
}

const RADIUS_VALUE = 24;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: '100%',
    paddingHorizontal: 16,
  },
  searchBar: {
    flex: 1,
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    lineHeight: 24,
  },
  desc: {
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    marginTop: 8,
  },
  titleTextWrapper: {
    flex: 1,
  },
  netSwitchTabs: {
    marginBottom: 20,
  },
  innerBlock: {
    paddingHorizontal: 0,
  },
  inputContainerStyle: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
  },
  inputText: {
    color: colors2024['neutral-title-1'],
    marginLeft: 7,
    fontSize: 17,
    fontWeight: '400',
    paddingTop: 0,
    paddingBottom: 0,
    fontFamily: 'SF Pro Rounded',
  },

  chainListWrapper: {
    flexShrink: 1,
    height: '100%',
  },

  emptyDataWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    maxHeight: 400,
    // ...makeDebugBorder()
  },

  emptyText: {
    paddingTop: 21,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-info'],
  },

  titleView: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },

  inputWrapper: {
    marginRight: 15,
    flex: 1,
    overflow: 'hidden',
  },

  cancelText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 17,
    lineHeight: 22,
  },

  titleViewWithText: {
    marginBottom: 34,
  },

  iconSearch: {
    position: 'absolute',
    right: 4,
  },
  flatList: {
    paddingHorizontal: 0,
  },
  sectionFirst: {
    borderTopLeftRadius: RADIUS_VALUE,
    borderTopRightRadius: RADIUS_VALUE,
  },
  sectionLast: {
    borderBottomLeftRadius: RADIUS_VALUE,
    borderBottomRightRadius: RADIUS_VALUE,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
}));
