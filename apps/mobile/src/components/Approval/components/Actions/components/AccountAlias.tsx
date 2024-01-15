import { StyleSheet, View, Text } from 'react-native';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useAlias } from '@/hooks/alias';
// import { WALLET_BRAND_CONTENT, KEYRING_ICONS } from '@/constant/';

const styles = StyleSheet.create({
  wrapper: {
    display: 'flex',
    flexDirection: 'row', // Assuming you want a row layout
    alignItems: 'center',
    fontSize: 13,
    color: '#3e495e', // Default color if --r-neutral-body is not available
  },
  iconAccount: {
    width: 16,
    marginRight: 4,
  },
});

const AccountAlias = ({ address }: { address: string }) => {
  const [alias] = useAlias(address);

  if (!address) return null;

  return (
    <View style={styles.wrapper}>
      {/* <img
        style={styles.iconAccount}
        src={
          WALLET_BRAND_CONTENT[account.brandName]?.image ||
          KEYRING_ICONS[account.type]
        }
      /> */}
      <Text className="flex-1 overflow-hidden overflow-ellipsis whitespace-nowrap">
        {alias}
      </Text>
    </View>
  );
};

export default AccountAlias;
