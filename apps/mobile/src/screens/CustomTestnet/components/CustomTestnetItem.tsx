// import { Chain } from '@debank/common';
// import { Form, Input } from 'antd';
// import clsx from 'clsx';
// import React from 'react';
// import styled from 'styled-components';
// import { ReactComponent as RcIconEdit } from '@/ui/assets/custom-testnet/icon-edit.svg';
// import { ReactComponent as RcIconDelete } from '@/ui/assets/custom-testnet/cc-delete.svg';
// import ThemeIcon from '@/ui/component/ThemeMode/ThemeIcon';
// import {
//   TestnetChain,
//   TestnetChainBase,
// } from '@/background/service/customTestnet';
// import { TestnetChainLogo } from '@/ui/component/TestnetChainLogo';
import { AppColorsVariants } from '@/constant/theme';
import { TestnetChain } from '@/core/services/customTestnetService';
import { useThemeColors } from '@/hooks/theme';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

export const CustomTestnetItem = ({
  className,
  item,
  onEdit,
  onRemove,
  onPress,
  editable,
  disabled,
}: {
  className?: string;
  item: TestnetChain;
  onEdit?: (item: TestnetChain) => void;
  onRemove?: (item: TestnetChain) => void;
  onPress?: (item: TestnetChain) => void;
  editable?: boolean;
  disabled?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { t } = useTranslation();
  return (
    <TouchableOpacity
      onPress={() => {
        onPress?.(item);
      }}>
      <View style={styles.item}>
        {/* <TestnetChainLogo name={item.name} className="flex-shrink-0" /> */}
        {/* <Image
          style={styles.logo}
          source={{
            uri: item.logo,
          }}
        /> */}
        <View className="min-w-0">
          <Text className="text-[15px] leading-[18px] mb-[2px] font-medium text-r-neutral-title1">
            {item.name}
          </Text>
          <View className="flex items-center gap-[16px]">
            <Text className="text-[12px] leading-[14px] text-r-neutral-foot">
              {t('page.customTestnet.currency')}:{' '}
              <Text className="text-r-neutral-body">
                {item.nativeTokenSymbol}
              </Text>
            </Text>
            <Text className="text-[12px] leading-[14px] text-r-neutral-foot">
              {t('page.customTestnet.id')}:{' '}
              <Text className="text-r-neutral-body">{item.id}</Text>
            </Text>
          </View>
        </View>
        {/* {editable ? (
        <div className="group-hover:visible flex items-center gap-[12px] ml-auto invisible">
          <ThemeIcon
            src={RcIconEdit}
            className="cursor-pointer"
            onClick={() => {
              onEdit?.(item);
            }}></ThemeIcon>
          <div className="cursor-pointer text-r-red-default">
            <RcIconDelete
              onClick={() => {
                onRemove?.(item);
              }}
            />
          </div>
        </div>
      ) : null} */}
      </View>
    </TouchableOpacity>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    item: {
      flexDirection: 'row',
    },
    logo: {
      width: 32,
      height: 32,
    },
  });
