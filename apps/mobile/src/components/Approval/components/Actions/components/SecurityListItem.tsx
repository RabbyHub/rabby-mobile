import { View, Text } from 'react-native';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import React from 'react';
import { SecurityListItemTag } from './SecurityListItemTag';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';
import { capitalize } from 'lodash';
import { SubCol, SubRow } from './SubTable';

export interface Props {
  id: string;
  engineResult: Result;
  dangerText?: string | React.ReactNode;
  warningText?: string | React.ReactNode;
  safeText?: string | React.ReactNode;
  defaultText?: string | React.ReactNode;
  forbiddenText?: string | React.ReactNode;
  title?: string;
  noTitle?: boolean;
  tip?: string;
}

export const SecurityListItem: React.FC<Props> = ({
  id,
  engineResult,
  dangerText,
  warningText,
  safeText,
  defaultText,
  forbiddenText,
  title,
  noTitle = false,
  tip,
}) => {
  const commonStyle = useCommonStyle();
  const displayTitle =
    title || (engineResult?.level ? capitalize(engineResult.level) : '');
  const hasTitle = !!(noTitle ? '' : displayTitle);

  if (!engineResult && !defaultText) {
    return null;
  }

  const textStyle = hasTitle
    ? commonStyle.subRowText
    : commonStyle.subRowNestedText;

  return (
    <SubCol nested={!hasTitle}>
      <SubRow tip={tip} isTitle>
        <Text style={commonStyle.subRowTitleText}>
          {noTitle ? '' : displayTitle}
        </Text>
      </SubRow>
      <SubRow>
        {engineResult ? (
          <View>
            {engineResult.level === Level.DANGER ? (
              typeof dangerText === 'string' ? (
                <Text style={textStyle}>{dangerText}</Text>
              ) : (
                dangerText
              )
            ) : null}
            {engineResult.level === Level.WARNING ? (
              typeof warningText === 'string' ? (
                <Text style={textStyle}>{warningText}</Text>
              ) : (
                warningText
              )
            ) : null}
            {engineResult.level === Level.SAFE ? (
              typeof safeText === 'string' ? (
                <Text style={textStyle}>{safeText}</Text>
              ) : (
                safeText
              )
            ) : null}
            {engineResult.level === Level.FORBIDDEN ? (
              typeof forbiddenText === 'string' ? (
                <Text style={textStyle}>{forbiddenText}</Text>
              ) : (
                forbiddenText
              )
            ) : null}

            <SecurityListItemTag
              inSubTable
              id={id}
              engineResult={engineResult}
            />
          </View>
        ) : (
          <Text style={textStyle}>{defaultText}</Text>
        )}
      </SubRow>
    </SubCol>
  );
};
