import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import { FooterButton } from '@/components/FooterButton/FooterButton';
import { AppColorsVariants } from '@/constant/theme';
import { apiCustomTestnet } from '@/core/apis';
import {
  TestnetChain,
  TestnetChainBase,
} from '@/core/services/customTestnetService';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { matomoRequestEvent } from '@/utils/analytics';
import { useMemoizedFn, useRequest, useSetState } from 'ahooks';
import { sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditCustomTestnetPopup } from './components/EditTestnetPopup';
import { Empty } from './components/Empty';
import { CustomTestnetItem } from './components/CustomTestnetItem';
import { toast } from '@/components/Toast';

export function CustomTestnetScreen(): JSX.Element {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const navigation = useRabbyAppNavigation();
  const { bottom } = useSafeAreaInsets();
  const { t } = useTranslation();

  const [state, setState] = useSetState<{
    isShowModal: boolean;
    current?: TestnetChainBase | null;
    isEdit: boolean;
  }>({
    isShowModal: false,
    current: null,
    isEdit: false,
  });

  const handleAddClick = useMemoizedFn(() => {
    const next = {
      isShowModal: true,
      current: null,
      isEdit: false,
    };
    setState(next);

    matomoRequestEvent({
      category: 'Custom Network',
      action: 'Click Add Network',
    });
  });

  const { data: list, runAsync: runGetCustomTestnetList } = useRequest(
    async () => {
      const res = await apiCustomTestnet.getCustomTestnetList();
      return sortBy(res, 'name');
    },
  );

  const handleConfirm = useMemoizedFn(async () => {
    setState({
      isShowModal: false,
      current: null,
      isEdit: false,
    });
    const list = await runGetCustomTestnetList();
    // updateChainStore({
    //   testnetList: list,
    // });
  });

  const handleRemoveClick = useMemoizedFn(async (item: TestnetChain) => {
    await apiCustomTestnet.removeCustomTestnet(item.id);
    toast.success(t('global.Deleted'));
    const list = await runGetCustomTestnetList();
    // updateChainStore({
    //   testnetList: list,
    // });
  });

  const handleEditClick = useMemoizedFn(async (item: TestnetChain) => {
    const next = {
      isShowModal: true,
      current: item,
      isEdit: true,
    };
    setState(next);
  });

  return (
    <>
      <NormalScreenContainer>
        <View style={styles.descContainer}>
          <Text style={styles.desc}>{t('page.customTestnet.desc')}</Text>
        </View>
        <View style={styles.main}>
          <FlatList
            style={styles.list}
            data={list}
            renderItem={({ item }) => {
              return (
                <CustomTestnetItem
                  item={item}
                  onEdit={handleEditClick}
                  onRemove={handleRemoveClick}
                  editable
                  containerStyle={styles.item}
                />
              );
            }}
            keyExtractor={item => item.enum}
            ListEmptyComponent={
              <Empty
                description={t('page.customTestnet.empty')}
                style={{
                  paddingTop: 200,
                }}
              />
            }
          />
        </View>
        <FooterButton
          title={t('page.customTestnet.add')}
          onPress={handleAddClick}
        />
      </NormalScreenContainer>
      <EditCustomTestnetPopup
        visible={state.isShowModal}
        data={state.current}
        isEdit={state.isEdit}
        onCancel={() => {
          setState({
            isShowModal: false,
            current: null,
            isEdit: false,
          });
        }}
        onChange={values => {}}
        onConfirm={handleConfirm}
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
