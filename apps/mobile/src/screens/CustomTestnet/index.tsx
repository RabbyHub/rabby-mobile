import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useCallback } from 'react';

import { FooterButton } from '@/components/FooterButton/FooterButton';
import { toast } from '@/components/Toast';
import { AppColorsVariants } from '@/constant/theme';
import { apiCustomTestnet } from '@/core/apis';
import {
  TestnetChain,
  TestnetChainBase,
} from '@/core/services/customTestnetService';
import { useThemeColors } from '@/hooks/theme';
import { matomoRequestEvent } from '@/utils/analytics';
import {
  useEventEmitter,
  useMemoizedFn,
  useRequest,
  useSetState,
} from 'ahooks';
import { sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import {
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { CustomTestnetItem } from './components/CustomTestnetItem';
import {
  EditCustomTestnetPopup,
  EditCustomTestnetPopupType,
} from './components/EditTestnetPopup';
import { Empty } from './components/Empty';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { useFocusEffect } from '@react-navigation/native';

export function CustomTestnetScreen(): JSX.Element {
  const colors = useThemeColors();
  const styles = getStyles(colors);
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

  const close$ = useEventEmitter<void>();

  const handleAddClick = useMemoizedFn(() => {
    const next = {
      isShowModal: true,
      current: null,
      isEdit: false,
    };
    setState(next);
    close$.emit();

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
    close$.emit();
    await runGetCustomTestnetList();
  });

  const handleRemoveClick = useMemoizedFn(async (item: TestnetChain) => {
    await apiCustomTestnet.removeCustomTestnet(item.id);
    toast.success(t('global.Deleted'));
    await runGetCustomTestnetList();
    close$.emit();
  });

  const handleEditClick = useMemoizedFn(async (item: TestnetChain) => {
    const next = {
      isShowModal: true,
      current: item,
      isEdit: true,
    };
    setState(next);
    close$.emit();
  });

  const modalRef = React.useRef<EditCustomTestnetPopupType>(null);
  const { onHardwareBackHandler } = useHandleBackPressClosable(
    useCallback(() => {
      modalRef.current?.doBack();
      return !state.isShowModal;
    }, [state]),
  );

  useFocusEffect(onHardwareBackHandler);

  return (
    <>
      <TouchableWithoutFeedback
        onPress={() => {
          close$.emit();
          console.log('custom testnet screen 1');
        }}
        accessible={false}
        style={{
          height: '100%',
        }}>
        <NormalScreenContainer>
          <View style={styles.descContainer}>
            <Text style={styles.desc}>{t('page.customTestnet.desc')}</Text>
          </View>
          <View style={styles.main}>
            <FlatList
              style={styles.list}
              data={list}
              onScrollBeginDrag={() => close$.emit()}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                return (
                  <CustomTestnetItem
                    item={item}
                    onEdit={handleEditClick}
                    onRemove={handleRemoveClick}
                    onPress={handleEditClick}
                    editable
                    containerStyle={styles.item}
                    close$={close$}
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
            TouchableComponent={TouchableOpacity}
          />
        </NormalScreenContainer>
      </TouchableWithoutFeedback>
      <EditCustomTestnetPopup
        ref={modalRef}
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
