import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useEffect, useMemo, useState } from 'react';

import { FooterButton } from '@/components/FooterButton/FooterButton';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { matomoRequestEvent } from '@/utils/analytics';
import { useEventEmitter, useMemoizedFn, useMount } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import {
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
// import { EditCustomTestnetPopup } from './components/EditTestnetPopup';
import { SelectSortedChainModal } from '@/components/SelectSortedChain';
import { CHAINS_ENUM, getChainList } from '@/constant/chains';
import { RPCItem } from '@/core/services/customRPCService';
import { useCustomRPC } from '@/hooks/useCustomRPC';
import { Empty } from './components/Empty';
import { EditCustomRPCPopup } from './components/EditCustomRPCPopup';
import { CustomRPCItem } from './components/CustomRPCItem';
import Toast from 'react-native-root-toast';
import { toast } from '@/components/Toast';
import { useNavigationState } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { findChain } from '@/utils/chain';

export function CustomRPCScreen(): JSX.Element {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const { t } = useTranslation();

  const [chainSelectorVisible, setChainSelectorVisible] = useState(false);
  const [rpcModalVisible, setRPCModalVisible] = useState(false);
  const [selectedChain, setSelectedChain] = useState<CHAINS_ENUM>(
    CHAINS_ENUM.ETH,
  );
  const [editRPC, setEditRPC] = useState<{
    id: CHAINS_ENUM;
    rpc: RPCItem;
  } | null>(null);

  const close$ = useEventEmitter<void>();
  const {
    customRPCStore: customRPC,
    setCustomRPC,
    setRPCEnable,
    deleteCustomRPC,
  } = useCustomRPC();

  const rpcList = useMemo(() => {
    return Object.keys(customRPC).map(key => ({
      id: key as CHAINS_ENUM,
      rpc: customRPC[key] as RPCItem,
    }));
  }, [customRPC]);

  const handleChainChanged = useMemoizedFn((chain: CHAINS_ENUM) => {
    setSelectedChain(chain);
    if (customRPC[chain]) {
      setEditRPC({
        id: chain,
        rpc: customRPC[chain],
      });
    }
    setRPCModalVisible(true);
    // setChainSelectorVisible(false);
  });

  const handleEditRPC = useMemoizedFn(
    (item: { id: CHAINS_ENUM; rpc: RPCItem }) => {
      setSelectedChain(item.id);
      setEditRPC(item);
      setRPCModalVisible(true);
    },
  );

  const handleCancelSelectChain = useMemoizedFn(() => {
    setChainSelectorVisible(false);
  });

  const handleClickAdd = useMemoizedFn(() => {
    setEditRPC(null);
    setChainSelectorVisible(true);
  });

  const handleConfirmCustomRPC = useMemoizedFn(async (url: string) => {
    await setCustomRPC({
      chain: selectedChain,
      url,
    });
    setChainSelectorVisible(false);
    setRPCModalVisible(false);
    setEditRPC(null);
    matomoRequestEvent({
      category: 'CustomRPC',
      action: 'add',
      label: selectedChain,
    });
  });

  const handleCancelEditCustomRPC = useMemoizedFn(() => {
    setRPCModalVisible(false);
    setEditRPC(null);
  });

  const handleSwitchRPCEnable = useMemoizedFn(
    async (val: boolean, item: { id: CHAINS_ENUM; rpc: RPCItem }) => {
      await setRPCEnable({
        chain: item.id,
        enable: val,
      });
      toast.success(
        val ? t('page.customRpc.opened') : t('page.customRpc.closed'),
      );
    },
  );

  const handleDelete = useMemoizedFn(
    async (item: { id: CHAINS_ENUM; rpc: RPCItem }) => {
      await deleteCustomRPC(item.id);
      toast.success(t('global.Deleted'));
      matomoRequestEvent({
        category: 'CustomRPC',
        action: 'delete',
        label: item.id,
      });
    },
  );

  const state = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.CustomRPC)?.params,
  ) as
    | {
        chainId: number;
        rpcUrl: string;
      }
    | undefined;

  useMount(() => {
    if (state) {
      const { chainId, rpcUrl } = state;
      const chainInfo = findChain({
        id: chainId,
      });
      if (chainInfo) {
        const chain = chainInfo.enum;
        setSelectedChain(chain);
        setEditRPC({
          id: chain,
          rpc: { ...(customRPC[chain] || { enable: false }), url: rpcUrl },
        });
        setRPCModalVisible(true);
      }
    }
  });

  return (
    <>
      <TouchableWithoutFeedback
        onPress={() => {
          close$.emit();
        }}
        accessible={false}
        style={{
          height: '100%',
        }}>
        <NormalScreenContainer>
          <View style={styles.descContainer}>
            <Text style={styles.desc}>{t('page.customRpc.desc')}</Text>
          </View>
          <View style={styles.main}>
            <FlatList
              style={styles.list}
              data={rpcList}
              onScrollBeginDrag={() => close$.emit()}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                return (
                  <CustomRPCItem
                    item={item}
                    onEdit={handleEditRPC}
                    onRemove={handleDelete}
                    onPress={handleEditRPC}
                    onEnabled={handleSwitchRPCEnable}
                    containerStyle={styles.item}
                    close$={close$}
                  />
                );
              }}
              keyExtractor={item => item.id}
              ListEmptyComponent={
                <Empty
                  description={t('page.customRpc.empty')}
                  style={{
                    paddingTop: 200,
                  }}
                />
              }
            />
          </View>
          <FooterButton
            title={t('page.customRpc.add')}
            onPress={handleClickAdd}
            TouchableComponent={TouchableOpacity}
          />
        </NormalScreenContainer>
      </TouchableWithoutFeedback>

      <SelectSortedChainModal
        supportChains={getChainList('mainnet').map(item => item.enum)}
        visible={chainSelectorVisible}
        onChange={handleChainChanged}
        onCancel={handleCancelSelectChain}
        hideTestnetTab
      />
      <EditCustomRPCPopup
        visible={rpcModalVisible}
        rpcInfo={editRPC}
        chainEnum={selectedChain}
        onCancel={handleCancelEditCustomRPC}
        onConfirm={handleConfirmCustomRPC}
      />
    </>
  );
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    descContainer: {
      marginTop: 8,
      marginBottom: 20,
      paddingHorizontal: 20,
    },
    desc: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 16,
      textAlign: 'center',
      color: colors['neutral-body'],
    },
    main: {
      flex: 1,
    },
    list: {
      paddingHorizontal: 20,
      height: '100%',
    },
    item: {
      marginBottom: 12,
    },
  });
