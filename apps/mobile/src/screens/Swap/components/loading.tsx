import React, { useMemo } from 'react';
import { QuoteLogo } from './QuoteLogo';
import { useSwapSettings } from '../hooks';
import { StyleSheet, Text, View } from 'react-native';
import { Skeleton } from '@rneui/themed';
import { CEX, DEX } from '@/constant/swap';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';

type QuoteListLoadingProps = {
  fetchedList?: string[];
  isCex?: boolean;
};

export const QuoteLoading = ({
  logo,
  name,
  isCex = false,
}: {
  logo: string;
  name: string;
  isCex?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View
      style={useMemo(
        () => [
          styles.container,
          {
            height: isCex ? 48 : 66,
            borderWidth: isCex ? 0 : StyleSheet.hairlineWidth,
            paddingHorizontal: isCex ? 0 : 12,
          },
        ],
        [isCex, styles.container],
      )}>
      <QuoteLogo isLoading={true} logo={logo} />
      <Text style={styles.text}>{name}</Text>
      <Skeleton style={styles.skeleton1} />
      <Skeleton style={styles.skeleton2} />
    </View>
  );
};

export const QuoteListLoading = ({
  fetchedList: dataList,
  isCex,
}: QuoteListLoadingProps) => {
  const { swapViewList } = useSwapSettings();
  return (
    <>
      {Object.entries(isCex ? CEX : DEX).map(([key, value]) => {
        if (
          (dataList && dataList.includes(key)) ||
          swapViewList?.[key] === false
        ) {
          return null;
        }
        return (
          <QuoteLoading
            logo={value.logo}
            key={key}
            name={value.name}
            isCex={isCex}
          />
        );
      })}
    </>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 6,
    borderColor: colors['neutral-line'],
  },
  text: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '500',
    color: colors['neutral-title-1'],
    width: 100,
  },
  skeleton1: {
    borderRadius: 2,
    width: 90,
    height: 20,
  },
  skeleton2: {
    marginLeft: 'auto',
    borderRadius: 2,
    width: 57,
    height: 20,
  },
}));
