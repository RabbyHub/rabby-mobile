import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Divide } from './Divide';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import { createGetStyles2024 } from '@/utils/styles';

const getStyle = createGetStyles2024(({ colors, colors2024, isLight }) =>
  StyleSheet.create({
    card: {
      borderRadius: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      borderColor: isLight ? colors['neutral-card-1'] : 'transparent',
      borderWidth: 1,
      borderStyle: 'solid',
    },
    cardTitle: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: 12,
      alignItems: 'center',
      flexDirection: 'row',
    },
    headline: {
      color: colors['neutral-title-1'],
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 16,
    },
    icon: {
      marginTop: 1,
    },
    action: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    actionText: {
      color: colors['neutral-body'],
      fontSize: 13,
      lineHeight: 16,
    },
  }),
);

interface CardProps {
  headline?: string;
  actionText?: string;
  onAction?: () => void;
  hasDivider?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const CardInner: React.FC<CardProps> = ({
  headline,
  actionText,
  onAction,
  hasDivider,
  children,
  style,
}) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={StyleSheet.flatten([styles.card, style])}>
      {headline && (
        <>
          <CardTitle
            headline={headline}
            actionText={actionText}
            onAction={onAction}
            hasAction={!!onAction || !!actionText}
          />
          {hasDivider && <Divide />}
        </>
      )}
      {children}
    </View>
  );
};

export const Card: React.FC<CardProps> = ({ onAction, style, ...props }) => {
  if (onAction) {
    return (
      <TouchableOpacity style={style} onPress={onAction}>
        <CardInner onAction={onAction} {...props} />
      </TouchableOpacity>
    );
  }

  return <CardInner style={style} {...props} />;
};

export const CardTitle: React.FC<
  Pick<CardProps, 'headline' | 'actionText' | 'onAction'> & {
    hasAction: boolean;
  }
> = ({ headline, actionText, onAction, hasAction }) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.cardTitle}>
      <Text style={styles.headline}>{headline}</Text>
      {hasAction && (
        <View style={styles.action}>
          <Text style={styles.actionText}>{actionText}</Text>
          <RcIconArrowRight style={styles.icon} />
        </View>
      )}
    </View>
  );
};
