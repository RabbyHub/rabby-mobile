import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useAccounts } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { removeAddress } from '@/core/apis/address';

function CurrentAddressScreen(): JSX.Element {
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
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  backgroundColor: colors['neutral-bg-1'],
                  // marginBottom: idx >= accounts?.length - 1 ? 0 : 12,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                <Text style={{ flexShrink: 1 }}>{account.address}</Text>
                <TouchableItem
                  onPress={() => {
                    removeAddress(account.address);
                    setTimeout(fetchAccounts, 300);
                  }}
                  style={{
                    flexShrink: 0,
                    width: 50,
                    height: '100%',
                    marginLeft: 12,
                    // borderRadius: 8,
                    backgroundColor: colors['red-default'],
                  }}>
                  <Text style={{ textAlign: 'center', color: '#fff' }}>
                    {' '}
                    X{' '}
                  </Text>
                </TouchableItem>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </NormalScreenContainer>
  );
}

const styles = StyleSheet.create({});

export default CurrentAddressScreen;
