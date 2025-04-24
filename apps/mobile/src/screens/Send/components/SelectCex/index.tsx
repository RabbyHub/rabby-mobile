import React from 'react';
import { View, FlatList } from 'react-native';

import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ProjectItem } from '@rabby-wallet/rabby-api/dist/types';
import { CexItem } from './CexItem';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { useTranslation } from 'react-i18next';

export interface ISelectCexPorps {
  onSelect?: (item: ProjectItem) => void;
}
const SelectCex = ({ onSelect }: ISelectCexPorps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { list } = useCexSupportList();
  const { t } = useTranslation();

  return (
    <View style={[styles.screen]}>
      <Text style={styles.modalTitle}>
        {t('component.selectCexModal.title')}
      </Text>
      <FlatList
        data={list}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={Divider}
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
    </View>
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
  },
}));
