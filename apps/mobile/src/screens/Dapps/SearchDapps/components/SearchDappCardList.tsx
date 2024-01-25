import RcIconClose from '@/assets/icons/dapp/icon-close.svg';
import RcIconDropdown from '@/assets/icons/dapp/icon-dropdown.svg';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal/utils';
import { useThemeColors } from '@/hooks/theme';
import { findChainByEnum } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';
import React, { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { DappCard } from '../../components/DappCard';
import { DappInfo } from '@/core/services/dappService';

export const SearchDappCardList = ({
  data,
  onPress,
  onFavoritePress,
  onEndReached,
  total,
  chain,
  onChainChange,
  loading,
  empty,
}: {
  data: DappInfo[];
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  onEndReached?: () => void;
  total?: number;
  chain?: CHAINS_ENUM;
  onChainChange?: (chain?: CHAINS_ENUM) => void;
  loading?: boolean;
  empty?: ReactNode;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const chainInfo = React.useMemo(() => {
    return findChainByEnum(chain);
  }, [chain]);

  const isEmpty = !loading && !total;

  const activeSelectChainPopup = () => {
    const id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.SELECT_CHAIN,
      value: chain,
      onChange: (v: CHAINS_ENUM) => {
        onChainChange?.(v);
        removeGlobalBottomSheetModal(id);
      },
    });
  };

  return (
    <>
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          Found about{' '}
          <Text style={styles.listHeaderTextStrong}>
            {total != null ? total : '-'}
          </Text>{' '}
          results.
        </Text>
        <TouchableOpacity
          onPress={() => {
            activeSelectChainPopup();
          }}>
          {chainInfo ? (
            <View
              className="flex-row items-center rounded-l-[4] rounded-r-[4] bg-r-neutral-card1"
              onStartShouldSetResponder={() => true}>
              <View className="flex-row items-center pl-[10] py-[6]">
                <Image
                  source={{
                    uri: chainInfo.logo,
                  }}
                  className="w-[20] h-[20] rounded-full mr-[6]"
                />
                <Text>{chainInfo.name}</Text>
              </View>
              <TouchableWithoutFeedback
                disallowInterruption={true}
                className="px-[10] py-[6]"
                onPress={() => {
                  onChainChange?.(undefined);
                }}>
                <RcIconClose />
              </TouchableWithoutFeedback>
            </View>
          ) : (
            <View className="flex-row items-center gap-[2]">
              <Text className="text-r-neutral-body text-[13] leading-[16] font-medium">
                Select Chain
              </Text>
              <RcIconDropdown />
            </View>
          )}
        </TouchableOpacity>
      </View>
      {isEmpty ? (
        empty
      ) : (
        <FlatList
          data={data}
          style={styles.list}
          keyExtractor={item => item.origin}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.8}
          renderItem={({ item }) => {
            return (
              <View style={styles.listItem}>
                <DappCard
                  data={item}
                  onFavoritePress={onFavoritePress}
                  onPress={onPress}
                />
              </View>
            );
          }}
        />
      )}
    </>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    list: {
      paddingHorizontal: 20,
    },
    listHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      height: 32,
      marginBottom: 8,
      paddingHorizontal: 20,
    },
    listHeaderText: {
      fontSize: 13,
      lineHeight: 16,
      color: colors['neutral-foot'],
    },
    listHeaderTextStrong: {
      fontSize: 13,
      lineHeight: 16,
      color: colors['neutral-body'],
      fontWeight: '500',
    },
    listItem: {
      marginBottom: 12,
    },
  });
