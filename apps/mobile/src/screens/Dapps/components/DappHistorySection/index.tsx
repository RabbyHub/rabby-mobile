import RcIconHistory from '@/assets/icons/dapp/icon-history.svg';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { DappHistoryCardList } from './DappHistoryCardList';
import { DappHistorySectionEmpty } from './DappHistorySectionEmpty';

export const DappHistorySection = ({
  HeaderComponent,
  data,
  style,
  onPress,
  onFavoritePress,
  onDeletePress,
}: {
  data: DappInfo[];
  style?: StyleProp<ViewStyle>;
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  onDeletePress?: (dapp: DappInfo) => void;
  HeaderComponent?:
    | React.ComponentType<any>
    | React.ReactElement<any, string | React.JSXElementConstructor<any>>
    | null
    | undefined;
}) => {
  const { styles } = useTheme2024({ getStyle });

  const isEmpty = !data?.length;

  return (
    <View style={[styles.container, style]}>
      <DappHistoryCardList
        data={data}
        onPress={onPress}
        onFavoritePress={onFavoritePress}
        onDeletePress={onDeletePress}
        ListHeaderComponent={
          <>
            {HeaderComponent}
            <View style={styles.header}>
              <View style={styles.titleWarper}>
                {/* <RcIconHistory /> */}
                <Text style={styles.title}>History</Text>
                {isEmpty ? null : (
                  <Text style={styles.subTitle}>/Past 30 Days</Text>
                )}
              </View>
            </View>
          </>
        }
        ListEmptyComponent={DappHistorySectionEmpty}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    // paddingHorizontal: 24,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleWarper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    marginRight: 'auto',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  subTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
}));
