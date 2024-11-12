import RcIconClose from '@/assets/icons/dapp/icon-close.svg';
import RcIconRight from '@/assets/icons/dapp/icon-right.svg';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { CHAINS_ENUM } from '@/constant/chains';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { findChainByEnum } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Image, Keyboard, Platform, Text, View } from 'react-native';
import {
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { DappCard } from '../../components/DappCard';

export const DappSearchCardList = ({
  data,
  onPress,
  onFavoritePress,
  onEndReached,
  total,
  chain,
  onChainChange,
  loading,
}: {
  data: DappInfo[];
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  onEndReached?: () => void;
  total?: number;
  chain?: CHAINS_ENUM;
  onChainChange?: (chain?: CHAINS_ENUM) => void;
  loading?: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const chainInfo = React.useMemo(() => {
    return findChainByEnum(chain);
  }, [chain]);

  const activeSelectChainPopup = () => {
    const id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.SELECT_SORTED_CHAIN,
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
          Found{' '}
          <Text style={styles.listHeaderTextStrong}>
            {total != null ? total : '-'}
          </Text>{' '}
          {Platform.OS === 'ios' ? 'Website' : 'Dapps'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            activeSelectChainPopup();
            Keyboard.dismiss();
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
            <View style={styles.selectChain}>
              <Text style={styles.selectChainText}>Select Chain</Text>
              <RcIconRight />
            </View>
          )}
        </TouchableOpacity>
      </View>
      {loading ? null : (
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
                  isShowDesc
                />
              </View>
            );
          }}
        />
      )}
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  list: {
    paddingHorizontal: 20,
    flex: 1,
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  listHeaderText: {
    fontSize: 20,
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
  listHeaderTextStrong: {},
  listItem: {
    marginBottom: 12,
  },
  selectChain: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectChainText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
}));
