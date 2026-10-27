import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components2024/Button';
import RcIconBack from '@/assets/icons/custom-testnet/back.svg';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { toast } from '@/components2024/Toast';
import type {
  TestnetChain,
  TestnetChainBase,
} from '@/core/services/customTestnetService';
import { useThemeColors } from '@/hooks/theme';
import { useEventEmitter, useMemoizedFn, useSetState } from 'ahooks';
import type { EventEmitter } from 'ahooks/lib/useEventEmitter';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import { CustomTestnetItem } from './components/CustomTestnetItem';
import type { EditCustomTestnetPopupType } from './components/EditTestnetPopup';
import { EditCustomTestnetPopup } from './components/EditTestnetPopup';
import { Empty } from './components/Empty';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Text } from '@/components/Typography';
import {
  useCustomTestnetService,
  withCustomTestnetService,
} from './customTestnetServiceDependencies';

type CustomTestnetListProps = {
  isEditing: boolean;
  refreshVersion: number;
  onEdit: (item: TestnetChain) => void;
};

const CustomTestnetListContent = ({
  isEditing,
  refreshVersion,
  onEdit,
}: CustomTestnetListProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const customTestnetService = useCustomTestnetService();
  const [list, setList] = useState(() =>
    sortBy(customTestnetService.getList(), 'name'),
  );

  const refreshList = useMemoizedFn(() => {
    setList(sortBy(customTestnetService.getList(), 'name'));
  });

  useEffect(() => {
    refreshList();
  }, [refreshList, refreshVersion]);

  const handleRemoveClick = useMemoizedFn((item: TestnetChain) => {
    customTestnetService.remove(item.id);
    refreshList();
    toast.success(t('global.Deleted'));
  });

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={
        list.length ? styles.listContent : styles.emptyList
      }
      data={list}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => {
        return (
          <CustomTestnetItem
            item={item}
            onEdit={onEdit}
            onRemove={handleRemoveClick}
            editable={isEditing}
            containerStyle={styles.item}
          />
        );
      }}
      keyExtractor={item => item.enum}
      ListEmptyComponent={<Empty description={t('page.customTestnet.empty')} />}
    />
  );
};

const CustomTestnetList = withCustomTestnetService(CustomTestnetListContent);

export function CustomTestnetScreen(): JSX.Element {
  const { colors2024, styles } = useTheme2024({ getStyle: getStyles });
  const navigation = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
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

  const [listRefreshVersion, setListRefreshVersion] = useState(0);

  const handleAddClick = useMemoizedFn(() => {
    const next = {
      isShowModal: true,
      current: null,
      isEdit: false,
    };
    setState(next);
  });

  const handleConfirm = useMemoizedFn(async () => {
    setState({
      isShowModal: false,
      current: null,
      isEdit: false,
    });
    setListRefreshVersion(version => version + 1);
  });

  const handleEditClick = useMemoizedFn(async (item: TestnetChain) => {
    const next = {
      isShowModal: true,
      current: item,
      isEdit: true,
    };
    setState(next);
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
      <NormalScreenContainer noHeader overwriteStyle={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('global.backButton')}
            hitSlop={12}
            onPress={() => navigation.goBack()}>
            <RcIconBack
              color={colors2024['neutral-body']}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <View style={styles.headerTitle} pointerEvents="none">
            <Text style={styles.title}>
              {t('page.customTestnet.screenTitle')}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => setIsEditing(value => !value)}>
            <Text style={styles.editButton}>
              {t(isEditing ? 'global.Cancel' : 'global.Edit')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.descContainer}>
          <Text style={styles.desc}>{t('page.customTestnet.desc')}</Text>
        </View>
        <View style={styles.main}>
          <CustomTestnetList
            isEditing={isEditing}
            refreshVersion={listRefreshVersion}
            onEdit={handleEditClick}
          />
        </View>
        <View style={styles.footer}>
          <Button
            title={t('page.customTestnet.add')}
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
            onPress={handleAddClick}
          />
        </View>
      </NormalScreenContainer>
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

const getStyles = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  screen: {
    backgroundColor: colors2024['neutral-bg-0'],
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: {
    position: 'absolute',
    left: 64,
    right: 64,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  editButton: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['brand-default'],
  },
  descContainer: {
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  desc: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    color: colors2024['neutral-secondary'],
  },
  main: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  item: {
    marginBottom: 12,
  },
  emptyList: {
    flexGrow: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    backgroundColor: colors2024['neutral-bg-1'],
  },
}));
