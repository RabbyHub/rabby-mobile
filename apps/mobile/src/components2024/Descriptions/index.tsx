import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, Text, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Button, ButtonProps } from '../Button';
import AutoLockView from '@/components/AutoLockView';

export const Descriptions: React.FC<{
  title?: React.ReactNode;
  titleStyle?: StyleProp<TextStyle>;
  sectionStyle?: StyleProp<ViewStyle>;
  sectionDescStyle?: StyleProp<TextStyle>;
  sections: Array<{
    title?: string;
    description?: string;
  }>;
  content?: React.ReactNode;
  nextButtonProps?: ButtonProps;
  logoDom?: React.ReactNode;
}> = ({
  title,
  sections,
  nextButtonProps,
  titleStyle,
  sectionStyle,
  content,
  logoDom,
  sectionDescStyle,
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <AutoLockView as="View" style={styles.container}>
      {!!logoDom && logoDom}
      {!!title && <Text style={[styles.title, titleStyle]}>{title}</Text>}
      <View style={styles.sectionContainer}>
        {sections.map((section, idx) => (
          <View
            key={`section-${section.title}-${idx}`}
            style={[styles.section, sectionStyle]}>
            {!!section.title && (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            {!!section.description && (
              <Text style={[styles.sectionDesc, sectionDescStyle]}>
                {section.description}
              </Text>
            )}
          </View>
        ))}
        {content}
      </View>
      {nextButtonProps && (
        <Button containerStyle={styles.button} {...nextButtonProps} />
      )}
    </AutoLockView>
  );
};
const getStyles = createGetStyles2024(ctx => ({
  container: {
    paddingHorizontal: 25,
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 25,
    fontFamily: 'SF Pro Rounded',
  },
  sectionContainer: {
    paddingBottom: 32,
    width: '100%',
  },
  section: {
    marginTop: 28,
    lineHeight: 24,
  },
  sectionTitle: {
    marginBottom: 5,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  sectionDesc: {
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  button: {
    position: 'absolute',
    bottom: 56,
    width: '100%',
  },
}));
