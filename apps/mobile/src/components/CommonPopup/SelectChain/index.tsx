import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { Input } from '@rneui/themed';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SelectChainList } from './SelectChainList';

export const SelectChain: React.FC = () => {
  const { setTitle, account, setHeight } = useCommonPopupView();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  React.useEffect(() => {
    setTitle(t('page.dashboard.hd.howToSwitch'));
    setHeight(420);
  }, [setHeight, setTitle, t]);

  return (
    <View className="p-[10px]">
      <Input
        leftIcon={<Text>q</Text>}
        containerStyle={styles.containerStyle}
        inputContainerStyle={styles.inputContainerStyle}
        placeholder="Search chain"
      />
      <SelectChainList />
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) => {
  return StyleSheet.create({
    containerStyle: {
      paddingHorizontal: 0,
    },
    inputContainerStyle: {
      borderWidth: 1,
      borderRadius: 8,
      borderColor: colors['neutral-line'],
      paddingHorizontal: 16,
    },
  });
};
