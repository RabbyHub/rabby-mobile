import { AppColorsVariants } from '@/constant/theme';
import { useThemeStyles } from '@/hooks/theme';
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

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    card: {
      borderRadius: 8,
      backgroundColor: colors['neutral-card-1'],
      borderColor: colors['neutral-card-1'],
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
  });

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
  const { styles } = useThemeStyles(getStyle);

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
  const { styles } = useThemeStyles(getStyle);

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
