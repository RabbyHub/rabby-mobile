import React, { useCallback } from 'react';
import { View, Pressable, Text } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import RcIconArrowDownCC from '@/assets2024/icons/watchlist/sort.svg';
import { useTranslation } from 'react-i18next';

export type SortState = 'desc' | 'asc' | 'default';

interface TokenHeaderProps {
  volumeSort: SortState;
  fdvSort: SortState;
  onVolumeSort: () => void;
  onFdvSort: () => void;
  changeSort: SortState;
  onChangeSort: () => void;
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    gap: 2,
    flex: 1,
  },
  headerTextSeparator: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  tokenCell: {
    flex: 0,
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

const TokenHeader: React.FC<TokenHeaderProps> = ({
  volumeSort,
  fdvSort,
  onVolumeSort,
  onFdvSort,
  changeSort,
  onChangeSort,
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
      <View style={styles.headerLeft}>
        <Pressable
          style={[styles.headerCell, styles.tokenCell]}
          hitSlop={10}
          onPress={onVolumeSort}>
          <Text style={getTextStyle(volumeSort)}>
            {t('page.meme.tokenHeader.volume')}
          </Text>
          {renderArrows(volumeSort)}
        </Pressable>
        <Text style={styles.headerTextSeparator}> / </Text>
        <Pressable
          style={[styles.headerCell, styles.tokenCell]}
          hitSlop={10}
          onPress={onFdvSort}>
          <Text style={getTextStyle(fdvSort)}>
            {t('page.meme.tokenHeader.fdv')}
          </Text>
          {renderArrows(fdvSort)}
        </Pressable>
      </View>
      <View style={[styles.headerCell, styles.priceCell]}>
        <Text style={styles.headerText}>
          {t('page.meme.tokenHeader.price')}
        </Text>
      </View>
      <Pressable
        style={[styles.headerCell, styles.changeCell]}
        hitSlop={10}
        onPress={onChangeSort}>
        <Text style={getTextStyle(changeSort)}>
          {t('page.meme.tokenHeader.change')}
        </Text>
        {renderArrows(changeSort)}
      </Pressable>
    </View>
  );
};

export default TokenHeader;
