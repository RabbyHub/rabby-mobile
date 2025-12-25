import RcIconClose from '@/assets/icons/dapp/icon-close.svg';
import RcIconRight from '@/assets/icons/dapp/icon-right.svg';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { CHAINS_ENUM } from '@/constant/chains';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { findChainByEnum } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import {
  FlatListProps,
  Image,
  Keyboard,
  Platform,
  Text,
  View,
} from 'react-native';
import {
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { DappCard } from '../../components/DappCard';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { Account } from '@/core/services/preference';

export const DappSearchCardList = ({
  keyword,
  data,
  onPress,
  onFavoritePress,
  onEndReached,
  total,
  chain,
  onChainChange,
  loading,
  ListEmptyComponent,
  account,
}: {
  keyword?: string;
  data: DappInfo[];
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  onEndReached?: () => void;
  total?: number;
  chain?: CHAINS_ENUM;
  onChainChange?: (chain?: CHAINS_ENUM) => void;
  loading?: boolean;
  ListEmptyComponent?: FlatListProps<any>['ListEmptyComponent'];
  account?: Account;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const chainInfo = React.useMemo(() => {
    return findChainByEnum(chain);
  }, [chain]);

  const activeSelectChainPopup = () => {
    if (!account) return;
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY,
      value: chain,
      hideTestnetTab: true,
      titleText: t('page.receiveAddressList.selectChainTitle'),
      account,
      bottomSheetModalProps: {
        rootViewType: 'View',
      },
      onChange: (v: CHAINS_ENUM) => {
        onChainChange?.(v);
        removeGlobalBottomSheetModal2024(id);
      },
      onClose: () => {
        removeGlobalBottomSheetModal2024(id);
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
          {Platform.OS === 'ios'
            ? (total || 0) > 1
              ? 'Websites'
              : 'Website'
            : (total || 0) > 1
            ? 'Dapps'
            : 'Dapp'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            activeSelectChainPopup();
            Keyboard.dismiss();
          }}>
          {chainInfo ? (
            <View
              style={styles.chainInfoContainer}
              onStartShouldSetResponder={() => true}>
              <View style={styles.chainInfo}>
                <Image
                  source={{
                    uri: chainInfo.logo,
                  }}
                  style={styles.chainIcon}
                />
                <Text style={styles.chainName}>{chainInfo.name}</Text>
              </View>
              <TouchableWithoutFeedback
                disallowInterruption={true}
                style={styles.close}
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
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={ListEmptyComponent}
          renderItem={({ item }) => {
            return (
              <View style={styles.listItem}>
                <DappCard
                  keyword={keyword}
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
  chainInfoContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  chainInfo: {
    paddingLeft: 10,
    paddingVertical: 6,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chainIcon: {
    width: 20,
    height: 20,
    borderRadius: 1000,
  },
  chainName: {
    //todo
  },
  close: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
}));
