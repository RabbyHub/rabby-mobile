import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { StyleSheet, View, Text } from 'react-native';
import { HistoryList } from './components/HistoryList';

function HistoryScreen(): JSX.Element {
  return (
    <NormalScreenContainer>
      <HistoryList />
    </NormalScreenContainer>
  );
}

const styles = StyleSheet.create({});

export default HistoryScreen;
