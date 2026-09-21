import React from 'react';
import { useSwapSettings, useSwapSupportedDexList } from '../hooks';
import { View } from 'react-native';
import { Skeleton } from '@rneui/themed';
import { DEX } from '@/constant/swap';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

type QuoteListLoadingProps = {
  fetchedList?: string[];
  isCex?: boolean;
};

export const QuoteLoading = ({
  isCex = false,
}: {
  logo: string;
  name: string;
  isCex?: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={[styles.dexLoading, isCex && styles.cexLoading]}>
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

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  dexLoading: {
    flexDirection: 'column',
    width: '100%',
    height: 82,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    borderColor: 'transparent',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  cexLoading: {
    height: 48,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
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
    color: colors2024['neutral-title-1'],
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
