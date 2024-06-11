import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import React from 'react';
import { View, Text } from 'react-native';

import { default as RcPasswordLockCC } from './icons/password-lock-cc.svg';
import { Button } from '@/components';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';

const LAYOUTS = {
  footerButtonHeight: 52,
  fixedFooterPaddingHorizontal: 20,
  fixedFooterPaddingVertical: 20,
  get fixedFooterHeight() {
    return this.footerButtonHeight + this.fixedFooterPaddingVertical * 2;
  },
};

export default function SetPasswordScreen() {
  const { styles, colors } = useThemeStyles(getStyles);

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPaddingBottom: LAYOUTS.fixedFooterHeight,
    footerHeight: LAYOUTS.fixedFooterHeight,
    nextButtonContainerHeight: LAYOUTS.footerButtonHeight,
  });

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: safeSizes.containerPaddingBottom },
      ]}>
      <View style={styles.topContainer}>
        <RcPasswordLockCC color={colors['neutral-title2']} />
        <Text style={styles.title1}>TopBodyFixedFooter</Text>
        <Text style={styles.title2}>
          sub title sub title sub title sub title sub title sub title sub title
          sub title
        </Text>
      </View>
      <View style={styles.bodyContainer}>
        <Text>TopBodyFixedFooter</Text>
      </View>
      <View
        style={[
          styles.fixedFooterContainer,
          { height: safeSizes.footerHeight },
        ]}>
        <Button
          disabled
          type="primary"
          containerStyle={[
            styles.nextButtonContainer,
            { height: safeSizes.nextButtonContainerHeight },
          ]}
          title={'Next'}
        />
      </View>
    </View>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      flex: 1,
      height: '100%',
      backgroundColor: colors['neutral-bg2'],
      paddingBottom: LAYOUTS.fixedFooterHeight,
    },
    topContainer: {
      backgroundColor: colors['blue-default'],
      height: 320,
      width: '100%',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      flexShrink: 0,
    },
    title1: {
      color: colors['neutral-title2'],
      fontSize: 24,
      fontWeight: '700',
      marginTop: 8,
    },
    title2: {
      color: colors['neutral-title2'],
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 8,
    },
    bodyContainer: {
      // backgroundColor: colors['neutral-bg2'],
      flexShrink: 1,
      height: '100%',
      paddingHorizontal: 20,
      paddingTop: 32,
      paddingBottom: 24,
      // ...makeDebugBorder()
    },
    fixedFooterContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors['neutral-bg2'],
      height: LAYOUTS.fixedFooterHeight,
      paddingVertical: LAYOUTS.fixedFooterPaddingVertical,
      paddingHorizontal: LAYOUTS.fixedFooterPaddingHorizontal,
      borderTopWidth: 1,
      borderTopColor: colors['neutral-line'],
    },
    nextButtonContainer: {
      width: '100%',
      height: LAYOUTS.footerButtonHeight,
    },
  };
});
