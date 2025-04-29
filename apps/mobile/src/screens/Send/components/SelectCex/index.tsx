import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ProjectItem } from '@rabby-wallet/rabby-api/dist/types';
import { CexItem } from './CexItem';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { useTranslation } from 'react-i18next';
import AutoLockView from '@/components/AutoLockView';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

export interface ISelectCexPorps {
  onSelect?: (item: ProjectItem) => void;
}
const SelectCex = ({ onSelect }: ISelectCexPorps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { list } = useCexSupportList();
  const { t } = useTranslation();

  return (
    <AutoLockView as="BottomSheetView" style={[styles.screen]}>
      <BottomSheetHandlableView>
        <Text style={styles.modalTitle}>
          {t('component.selectCexModal.title')}
        </Text>
      </BottomSheetHandlableView>
      <BottomSheetFlatList
        data={list}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={Divider}
        style={styles.scrollView}
        contentContainerStyle={{ flexGrow: 1 }}
        renderItem={({ item }) => {
          return (
            <CexItem
              onPress={() => onSelect?.(item)}
              name={item.name}
              id={item.id}
              logo_url={item.logo_url}
            />
          );
        }}
        ListFooterComponent={Footer}
      />
    </AutoLockView>
  );
};

const Divider = () => <View style={{ height: 8 }} />;
const Footer = () => <View style={{ height: 120 }} />;

export default SelectCex;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  modalTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    paddingTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  screen: {
    paddingHorizontal: 20,
    backgroundColor: colors2024['neutral-bg-2'],
    flex: 1,
  },
  scrollView: {
    flexShrink: 1,
    minHeight: 150,
    height: 200,
  },
}));
