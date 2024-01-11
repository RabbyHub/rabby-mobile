import { View, Text } from 'react-native';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import React from 'react';
import { SecurityListItemTag } from './SecurityListItemTag';

export interface Props {
  id: string;
  engineResult: Result;
  dangerText?: string | React.ReactNode;
  warningText?: string | React.ReactNode;
  safeText?: string | React.ReactNode;
  defaultText?: string | React.ReactNode;
  forbiddenText?: string | React.ReactNode;
}

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
        <View>
          <Text>{defaultText}</Text>
        </View>
      );
    }
    return null;
  }

  return (
    <View className="text-13 leading-[15px]">
      <Text>
        {engineResult.level === Level.DANGER && dangerText}
        {engineResult.level === Level.WARNING && warningText}
        {engineResult.level === Level.SAFE && safeText}
        {engineResult.level === Level.FORBIDDEN && forbiddenText}
      </Text>

      <SecurityListItemTag id={id} engineResult={engineResult} />
    </View>
  );
};
