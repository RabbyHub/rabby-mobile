import { AppBottomSheetModal, Text } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ListRenderItem, TouchableOpacity, View } from 'react-native';
import { GasTokenItem } from './TokenItem';
import RcIconBackCC from '@/assets/icons/gas-top-up/back-cc.svg';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import RcEmptyCC from '@/assets/icons/swap/empty-cc.svg';
import { Skeleton } from '@rneui/themed';

interface GasTopUpTokenSelectProps {
  visible?: boolean;
  setTokenModalVisible: any;
  loading: boolean;
  list: TokenItem[];
  onChange: (t: TokenItem) => void;
  cost: string;
}
const GasTopUpTokenSelect = ({
  setTokenModalVisible,
  loading,
  list,
  onChange,
  cost,
}: GasTopUpTokenSelectProps) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { t } = useTranslation();

  const RenderItem: ListRenderItem<TokenItem> = React.useCallback(
    ({ item }) => {
      return (
        <GasTokenItem
          item={item}
          cost={cost}
          onChange={onChange}
          setTokenModalVisible={setTokenModalVisible}
        />
      );
    },
    [cost, onChange, setTokenModalVisible],
  );

  const ListHeaderComponent = React.useCallback(() => {
    return (
      <View style={styles.header}>
        <View style={styles.rowCenter}>
          <Text style={styles.title}>
            {t('page.gasTopUp.Select-from-supported-tokens')}
          </Text>
        </View>
        <View style={styles.labelBox}>
          <Text style={styles.label}>
            {t('page.gasTopUp.Token')} / {t('page.gasTopUp.Balance')}
          </Text>
          <Text style={styles.label}>{t('page.gasTopUp.Value')}</Text>
        </View>
        <View style={styles.wrapper}>
          {!loading && list.length === 0 ? (
            <View style={styles.emptyView}>
              <RcEmptyCC color={colors['neutral-body']} />
              <Text style={styles.noToken}>{t('page.gasTopUp.No_Tokens')}</Text>
            </View>
          ) : null}
          {loading ? (
            <View style={styles.loadingView}>
              {Array.from({ length: 8 }).map((_, index) => (
                <Loader key={index} />
              ))}
              <Text style={styles.loadingText}>
                {/* {t('page.gasTopUp.Loading_Tokens')} */}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }, [
    styles.header,
    styles.rowCenter,
    styles.title,
    styles.labelBox,
    styles.label,
    styles.wrapper,
    styles.emptyView,
    styles.noToken,
    styles.loadingView,
    styles.loadingText,
    colors,
    t,
    loading,
    list.length,
  ]);

  return (
    <BottomSheetFlatList
      stickyHeaderIndices={[0]}
      ListHeaderComponent={ListHeaderComponent}
      style={{ flex: 1 }}
      data={list}
      keyExtractor={item => item.id + item.chain}
      renderItem={RenderItem}
    />
  );
};

function Loader() {
  return (
    <View
      style={{
        flex: 1,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        paddingHorizontal: 20,
      }}>
      <Skeleton width={32} height={32} circle />
      <Skeleton width={88} height={20} style={{ marginLeft: 20 }} />
      <View
        style={{
          marginLeft: 'auto',
        }}>
        <Skeleton
          width={78}
          height={20}
          skeletonStyle={{ marginLeft: 'auto' }}
        />
      </View>
    </View>
  );
}

export const GasTopUpTokenSelectModal = (props: GasTopUpTokenSelectProps) => {
  const bottomRef = useRef<BottomSheetModalMethods>(null);
  useEffect(() => {
    if (props.visible) {
      bottomRef.current?.present();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [props.visible]);

  return (
    <AppBottomSheetModal
      snapPoints={['80%']}
      ref={bottomRef}
      enableDismissOnClose
      onDismiss={() => props.setTokenModalVisible(false)}>
      <GasTopUpTokenSelect {...props} />
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  header: {
    paddingTop: 8,
    backgroundColor: colors['neutral-bg-1'],
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backWrapper: {
    position: 'absolute',
    left: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    color: colors['neutral-title-1'],
  },
  labelBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderColor: colors['neutral-line'],
    paddingTop: 24,
    paddingBottom: 8,
    marginHorizontal: 20,
  },
  label: {
    color: colors['neutral-body'],
    fontSize: 13,
    fontWeight: 'normal',
  },
  wrapper: { flex: 1, overflow: 'hidden' },
  emptyView: {
    gap: 20,
    alignItems: 'center',
    paddingTop: 100,
  },
  noToken: {
    fontSize: 14,
    color: colors['neutral-body'],
    marginBottom: 12,
  },
  loadingView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors['neutral-title-1'],
  },
}));
