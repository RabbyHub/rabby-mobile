import { View, Text, StyleSheet } from 'react-native';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import React from 'react';
import { SecurityListItemTag } from './SecurityListItemTag';
import DescItem from './DescItem';

export interface Props {
  id: string;
  engineResult: Result;
  dangerText?: string | React.ReactNode;
  warningText?: string | React.ReactNode;
  safeText?: string | React.ReactNode;
  defaultText?: string | React.ReactNode;
  forbiddenText?: string | React.ReactNode;
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
  },
  text: {
    fontSize: 13,
    lineHeight: 15,
  },
});

export const SecurityListItem: React.FC<Props> = ({
  id,
  engineResult,
  dangerText,
  warningText,
  safeText,
  defaultText,
  forbiddenText,
}) => {
  if (!engineResult) {
    if (defaultText) {
      return (
        <DescItem>
          <Text>{defaultText}</Text>
        </DescItem>
      );
    }
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <DescItem>
        {engineResult.level === Level.DANGER ? (
          typeof dangerText === 'string' ? (
            <Text>{dangerText}</Text>
          ) : (
            dangerText
          )
        ) : null}
        {engineResult.level === Level.WARNING ? (
          typeof warningText === 'string' ? (
            <Text>{warningText}</Text>
          ) : (
            warningText
          )
        ) : null}
        {engineResult.level === Level.SAFE ? (
          typeof safeText === 'string' ? (
            <Text>{safeText}</Text>
          ) : (
            safeText
          )
        ) : null}
        {engineResult.level === Level.FORBIDDEN ? (
          typeof forbiddenText === 'string' ? (
            <Text>{forbiddenText}</Text>
          ) : (
            forbiddenText
          )
        ) : null}
      </DescItem>
      <SecurityListItemTag id={id} engineResult={engineResult} />
    </View>
  );
};
