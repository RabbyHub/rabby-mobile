import { View, Text } from 'react-native';
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
    <DescItem>
      <Text>
        {engineResult.level === Level.DANGER && dangerText}
        {engineResult.level === Level.WARNING && warningText}
        {engineResult.level === Level.SAFE && safeText}
        {engineResult.level === Level.FORBIDDEN && forbiddenText}
      </Text>

      <SecurityListItemTag id={id} engineResult={engineResult} />
    </DescItem>
  );
};
