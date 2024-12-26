import React, { useMemo } from 'react';
import { useSwapSettings, useSwapSupportedDexList } from '../hooks';
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '@rneui/themed';
import { DEX } from '@/constant/swap';
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
  const viewStyle = useMemo(
    () => [
      styles.container,
      {
        height: isCex ? 48 : 66,
        borderWidth: isCex ? 0 : StyleSheet.hairlineWidth,
        paddingHorizontal: isCex ? 0 : 16,
      },
    ],
    [isCex, styles.container],
  );

  return (
    <View style={styles.dexLoading}>
      <View style={styles.column}>
        <View style={styles.dexNameColumn}>
          <Skeleton circle width={24} height={24} />
          <Skeleton style={styles.skeleton2} />
        </View>
        <Skeleton style={styles.skeleton3} />
      </View>
      <View style={styles.column}>
        <Skeleton style={styles.skeleton4} />
        <Skeleton style={styles.skeleton4} />
      </View>
    </View>
  );
};

export const QuoteListLoading = ({
  fetchedList: dataList,
  isCex,
}: QuoteListLoadingProps) => {
  const { swapViewList } = useSwapSettings();
  const [supportedDexList] = useSwapSupportedDexList();
  return (
    <>
      {supportedDexList.map(key => {
        if (
          (dataList && dataList.includes(key)) ||
          swapViewList?.[key] === false
        ) {
          return null;
        }
        return (
          <QuoteLoading
            logo={DEX?.[key]?.logo}
            key={key}
            name={DEX?.[key]?.name}
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
  dexLoading: {
    flexDirection: 'column',
    width: '100%',
    height: 90,
    paddingHorizontal: 16,
    justifyContent: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    borderColor: colors['neutral-line'],
  },
  column: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dexNameColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    marginLeft: 8,
    fontSize: 16,
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
    width: 70,
    height: 18,
  },
  skeleton3: {
    borderRadius: 2,
    width: 132,
    height: 18,
  },
  skeleton4: {
    borderRadius: 2,
    width: 90,
    height: 16,
  },
}));
