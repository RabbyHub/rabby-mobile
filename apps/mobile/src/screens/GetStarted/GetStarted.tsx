import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import clsx from 'clsx';

import { stringUtils } from '@rabby-wallet/base-utils';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {
  RcClearPending,
  RcCustomRpc,
  RcFollowUs,
  RcInfo,
  RcLock,
  RcManageAddress,
  RcSupportChains,
  RcThemeMode,
  RcWhitelist,
  RcEarth,
} from '@/assets/icons/settings';
import RcFooterLogo from '@/assets/icons/settings/footer-logo.svg';

import { type SettingConfBlock, Block } from './Block';
import { useAppTheme, useThemeColors } from '@/hooks/theme';
import { styled } from 'styled-components/native';
import { useSheetWebViewTester } from './sheetModals/hooks';
import SheetWebViewTester from './sheetModals/SheetWebViewTester';
import { BUILD_CHANNEL } from '@/constant/env';
import { useNavigation } from '@react-navigation/native';
import { RootNames, ScreenLayouts } from '@/constant/layout';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { RcIconLogo } from '@/assets/icons/common';
import { Button, Dialog } from '@rneui/themed';

function GetStartedScreen(): JSX.Element {
  const { appTheme, toggleThemeMode } = useAppTheme();

  const { openMetaMaskTestDapp } = useSheetWebViewTester();

  const colors = useThemeColors();

  const navigation = useNavigation();

  const { safeTop, safeOffBottom } = useSafeSizes();
  const styles = getStyles(colors);
  const [isShowModal, setIsShowModal] = useState(false);

  return (
    <>
      <View className="bg-r-blue-default h-full flex-col">
        <View
          style={{
            paddingTop: safeTop,
            paddingBottom: safeOffBottom,
          }}>
          <View className="flex-col px-[20] h-full items-center pt-[180]">
            <RcIconLogo />
            <Text className="text-r-neutral-title2 text-[24] leading-[28] font-semibold mb-[32]">
              Rabby Wallet
            </Text>
            <Text className="text-r-neutral-title2 text-[17] text-center leading-[24] font-medium mb-[220]">
              The game-changing wallet
              {'\n'}
              for Ethereum and all EVM chains
            </Text>

            <Button
              buttonStyle={styles.buttonStyle}
              titleStyle={styles.buttonTitleStyle}
              title="Get Started"
              onPress={() => {
                setIsShowModal(true);
              }}
            />
          </View>
        </View>
      </View>
      <Dialog
        isVisible={isShowModal}
        className="w-[353] max-w-[100%]"
        onBackdropPress={() => {
          setIsShowModal(false);
        }}>
        <Text className="text-r-neutral-title1 text-[20] leading-[24] font-medium text-center">
          Enter your invitation code and get started
        </Text>
        <TextInput
          // style={styles.input}
          // onChangeText={onChangeNumber}
          // value={number}
          placeholder="useless placeholder"
          // keyboardType="numeric"
        />
        <View className="flex-row items-center justify-center  w-full">
          <View className="flex-1 pr-[5]">
            <Button
              title="Cancel"
              buttonStyle={styles.cancelStyle}
              titleStyle={styles.cancelTitleStyle}
              onPress={() => {
                setIsShowModal(false);
              }}
            />
          </View>
          <View className="flex-1 pl-[5]">
            <Button
              title="Next"
              buttonStyle={styles.confirmStyle}
              titleStyle={styles.confirmTitleStyle}
              onPress={() => {
                console.log('todo');
              }}
            />
          </View>
        </View>
      </Dialog>
    </>
  );
}

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    buttonStyle: {
      width: 268,
      height: 56,
      borderRadius: 8,
      backgroundColor: colors['neutral-title2'],
      boxShadow: '0 8 24 0 rgba(0, 0, 0, 0.11)',
    },
    buttonTitleStyle: {
      fontSize: 17,
      lineHeight: 20,
      fontWeight: '600',
      color: colors['blue-default'],
    },
    cancelStyle: {
      backgroundColor: colors['neutral-card-1'],
      borderColor: colors['blue-default'],
      borderWidth: 1,
      borderStyle: 'solid',
      borderRadius: 6,
      height: 44,

      width: '100%',
    },
    cancelTitleStyle: {
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      color: colors['blue-default'],
    },
    confirmStyle: {
      backgroundColor: colors['blue-default'],
      height: 44,
      borderRadius: 6,
      width: '100%',
    },
    confirmTitleStyle: {
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      color: colors['neutral-title2'],
    },
  });

export default GetStartedScreen;
