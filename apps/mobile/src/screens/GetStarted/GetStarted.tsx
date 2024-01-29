import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { RcIconLogo } from '@/assets/icons/common';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { navigate } from '@/utils/navigation';
import { Button } from '@rneui/themed';
import { useRequest } from 'ahooks';
import axios from 'axios';
import { preferenceService } from '@/core/services';

function GetStartedScreen(): JSX.Element {
  const colors = useThemeColors();

  const { safeTop, safeOffBottom } = useSafeSizes();
  const styles = getStyles(colors);
  const [isShowModal, setIsShowModal] = useState(false);
  const [isFocus, setIsFocus] = useState(false);
  const [code, setCode] = useState('');
  const [errMessage, setErrMessage] = useState('');

  const { runAsync: invite, loading: isInviteLoading } = useRequest(
    (id: string) => {
      return axios.get<{ is_valid: boolean }>(
        'https://app-api.rabby.io/promotion/invitation',
        {
          params: {
            id,
          },
        },
      );
    },
    {
      manual: true,
    },
  );

  const handleGetStarted = async () => {
    if (preferenceService.getPreference('isInvited')) {
      navigate(RootNames.StackAddress, { screen: RootNames.ImportNewAddress });
    } else {
      setIsShowModal(true);
    }
  };

  const handleInvite = async () => {
    setErrMessage('');

    try {
      const { data } = await invite(code?.trim());

      if (data?.is_valid) {
        preferenceService.setPreference({
          isInvited: true,
        });
        navigate(RootNames.StackAddress, {
          screen: RootNames.ImportNewAddress,
        });
        setIsShowModal(false);
      } else {
        setErrMessage('Invalid invitation code');
      }
    } catch (e) {
      setErrMessage('Invalid invitation code');
    }
  };

  useEffect(() => {
    if (isShowModal) {
      setCode('');
    }
  }, [isShowModal]);

  return (
    <>
      <View>
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
                onPress={handleGetStarted}
              />
            </View>
          </View>
        </View>
      </View>
      <Modal
        visible={isShowModal}
        className="w-[353] max-w-[100%] "
        onRequestClose={() => {
          setIsShowModal(false);
        }}
        transparent
        animationType="fade">
        <TouchableWithoutFeedback
          onPress={() => {
            setIsShowModal(false);
          }}>
          <View style={styles.overlay}>
            <View
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}>
              <Text className="text-r-neutral-title1 text-[20] leading-[24] font-medium text-center mb-[20]">
                Enter Invite Code to get started
              </Text>
              <TextInput
                style={[
                  styles.input,
                  isFocus ? styles.inputFocus : null,
                  errMessage ? styles.inputError : null,
                ]}
                onFocus={() => {
                  setIsFocus(true);
                }}
                onBlur={() => {
                  setIsFocus(false);
                }}
                onChangeText={v => {
                  setCode(v);
                }}
                value={code}
              />
              <View className="h-[16] mt-[10]">
                {errMessage ? (
                  <Text className="text-r-red-default text-[13] leading-[16]">
                    {errMessage}
                  </Text>
                ) : null}
              </View>
              <View className="flex-row items-center justify-center w-full mt-[26]">
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
                    loading={isInviteLoading}
                    onPress={handleInvite}
                  />
                </View>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    touchable: {
      height: '100%',
      backgroundColor: colors['red-default'],
    },
    overlay: {
      backgroundColor: 'rgba(0,0,0,0.4)',
      height: '100%',
      justifyContent: 'center',
    },
    modalContent: {
      borderRadius: 8,
      backgroundColor: colors['neutral-bg1'],
      boxShadow: '0 20 20 0 rgba(45, 48, 51, 0.16)',
      marginHorizontal: 20,
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 20,
    },
    input: {
      borderColor: colors['neutral-line'],
      borderWidth: 1,
      borderStyle: 'solid',
      backgroundColor: colors['r-neutral-bg1'],
      height: 52,
      width: '100%',
      fontSize: 15,
      lineHeight: 18,
      padding: 15,
      borderRadius: 6,
    },
    inputFocus: {
      borderColor: colors['blue-default'],
    },
    inputError: {
      borderColor: colors['red-default'],
    },
  });

export default GetStartedScreen;
