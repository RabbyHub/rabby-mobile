import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useAccounts } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { removeAddress } from '@/core/apis/address';

export default function CurrentAddressScreen(): JSX.Element {
  const { accounts, fetchAccounts } = useAccounts();
  const colors = useThemeColors();

  return (
    <NormalScreenContainer>
      <View
        style={[
          {
            flex: 1,
            paddingTop: 20,
            alignItems: 'center',
          },
        ]}>
        <Text
          style={[
            {
              fontSize: 16,
            },
          ]}>
          Current Address Screen
        </Text>
        <ScrollView style={{ paddingTop: 14 }}>
          {accounts?.map((account, idx) => {
            return (
              <View
                key={`ac-${account.address}-${idx}`}
                className="p-[14] bg-r-neutral-bg-1 mb-12 flex-row items-center">
                <Text style={{ flexShrink: 1 }}>{account.address}</Text>
                <TouchableItem
                  onPress={() => {
                    removeAddress(account.address);
                    setTimeout(fetchAccounts, 300);
                  }}
                  className="bg-r-red-default flex-shrink-0 w-[50] h-[100%] ml-[12]">
                  <Text className="text-center text-[#fff]"> X </Text>
                </TouchableItem>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </NormalScreenContainer>
  );
}
