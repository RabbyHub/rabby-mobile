import React, { useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import RcIconArrowDownCC from '@/assets2024/icons/watchlist/sort.svg';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';

export type SortState = 'desc' | 'asc' | 'default';

interface TokenHeaderProps {
  tokenSort: SortState;
  onTokenSort: () => void;
  changeSort: SortState;
  onChangeSort: () => void;
  fdvSort?: SortState;
  onFdvSort?: () => void;
  showFdvSort?: boolean;
  disableSort?: boolean;
  disableLeftSort?: boolean;
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenCell: {
    flex: 2,
  },
  tokenCompoundCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  priceCell: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 'auto',
    marginRight: 11.6,
  },
  changeCell: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  headerTextActive: {
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
  iconWrap: {
    marginLeft: 4,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
  },
  icon: {
    width: 4,
    height: 3,
  },
  iconUp: {
    transform: [{ rotate: '180deg' }],
  },
}));

const WatchListHeader: React.FC<TokenHeaderProps> = ({
  tokenSort,
  onTokenSort,
  changeSort,
  onChangeSort,
  fdvSort = 'default',
  onFdvSort,
  showFdvSort = false,
  disableSort = false,
  disableLeftSort = false,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const getArrowColor = useCallback(
    (sort: SortState, direction: 'asc' | 'desc') => {
      if (sort === direction) {
        return colors2024['brand-default'];
      }
      return colors2024['neutral-info'];
    },
    [colors2024],
  );

  const getTextStyle = useCallback(
    (sort: SortState) => {
      if (sort === 'default') {
        return styles.headerText;
      }
      return [styles.headerText, styles.headerTextActive];
    },
    [styles.headerText, styles.headerTextActive],
  );

  const renderArrows = useCallback(
    (sort: SortState) => (
      <View style={styles.iconWrap}>
        <RcIconArrowDownCC
          style={[styles.icon, styles.iconUp]}
          color={getArrowColor(sort, 'asc')}
        />
        <RcIconArrowDownCC
          style={styles.icon}
          color={getArrowColor(sort, 'desc')}
        />
      </View>
    ),
    [getArrowColor, styles.icon, styles.iconUp, styles.iconWrap],
  );

  return (
    <View style={styles.headerRow}>
      {disableSort ? (
        <>
          <View style={[styles.headerCell, styles.tokenCell]}>
            <Text style={styles.headerText}>
              {t('page.watchlist.tokenHeader.token')}
            </Text>
          </View>
          <View style={[styles.headerCell, styles.changeCell]}>
            <Text style={styles.headerText}>
              {t('page.watchlist.tokenHeader.price')}
            </Text>
            <Text style={styles.headerText}>/</Text>
            <Text style={styles.headerText}>
              {t('page.watchlist.tokenHeader.change')}
            </Text>
          </View>
        </>
      ) : (
        <>
          {disableLeftSort ? (
            <View style={[styles.headerCell, styles.tokenCell]}>
              {showFdvSort ? (
                <View style={styles.tokenCompoundCell}>
                  <Text style={styles.headerText}>{t('global.Token')}</Text>
                  <Text style={styles.headerText}>/</Text>
                  <Pressable
                    style={styles.headerCell}
                    hitSlop={10}
                    onPress={onFdvSort}>
                    <Text style={getTextStyle(fdvSort)}>
                      {t('page.meme.tokenHeader.fdv')}
                    </Text>
                    {renderArrows(fdvSort)}
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.headerText}>
                  {t('page.watchlist.tokenHeader.token')}
                </Text>
              )}
            </View>
          ) : (
            <Pressable
              style={[styles.headerCell, styles.tokenCell]}
              hitSlop={10}
              onPress={onTokenSort}>
              <Text style={getTextStyle(tokenSort)}>
                {t('page.watchlist.tokenHeader.token')}
              </Text>
              {renderArrows(tokenSort)}
            </Pressable>
          )}
          <Pressable
            style={[styles.headerCell, styles.changeCell]}
            hitSlop={10}
            onPress={onChangeSort}>
            <Text style={getTextStyle('default')}>
              {t('page.watchlist.tokenHeader.price')}
            </Text>
            <Text style={getTextStyle('default')}>/</Text>
            <Text style={getTextStyle(changeSort)}>
              {t('page.watchlist.tokenHeader.change')}
            </Text>
            {renderArrows(changeSort)}
          </Pressable>
        </>
      )}
    </View>
  );
};

export default WatchListHeader;
