import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { OpenedDappItem } from '../../hooks/useDappView';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { DappCardInWebViewNav } from '../../components/DappCardInWebViewNav';
import { Button } from '@/components';
import { useDapps } from '@/hooks/useDapps';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';

const BOTTOM_CONTAINER_PADDING = 16;
export function BottomSheetContent({
  dappInfo,
  bottomNavBar,
  onPressCloseDapp,
}: {
  dappInfo?: OpenedDappItem | null;
  bottomNavBar: React.ReactNode;
  onPressCloseDapp?: () => void;
}) {
  const { updateFavorite, addDapp } = useDapps();

  const { styles } = useThemeStyles(getStyle);
  const { safeSizes, androidBottomOffset } = useSafeAndroidBottomSizes({});

  if (!dappInfo) return null;

  return (
    <View style={[styles.container, {}]}>
      {dappInfo?.maybeDappInfo && (
        <BottomSheetScrollView
          style={{
            minHeight: 108 - androidBottomOffset,
            // ...makeDebugBorder('red'),
          }}>
          <DappCardInWebViewNav
            data={dappInfo.maybeDappInfo}
            onFavoritePress={dapp => {
              updateFavorite(dapp.origin, !dapp.isFavorite);
            }}
          />
        </BottomSheetScrollView>
      )}

      <View style={[styles.navbarContainer]}>
        <View style={styles.bottomNavbarContainer}>{bottomNavBar}</View>
        <View style={styles.buttonWrapper}>
          <Button
            onPress={onPressCloseDapp}
            type="primary"
            ghost
            title={
              <View style={styles.titleWrapper}>
                <Text style={styles.textDisconnect}>
                  Close {Platform.OS === 'ios' ? 'Website' : 'Dapp'}
                </Text>
              </View>
            }
            style={styles.buttonInner}
            buttonStyle={styles.button}
            containerStyle={styles.buttonContainer}
          />
        </View>
      </View>
    </View>
  );
}

const getStyle = createGetStyles(colors => ({
  container: {
    flexShrink: 1,
    height: '100%',
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    // ...makeDebugBorder('yellow')
  },
  navbarContainer: {
    paddingHorizontal: 20,
    paddingVertical: BOTTOM_CONTAINER_PADDING,
    paddingBottom: 0,
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    // justifyContent: 'center',
  },
  bottomNavbarContainer: {
    flexShrink: 0,
    width: '100%',
    // ...makeDebugBorder('green'),
    paddingRight: 0,
  },
  buttonWrapper: {
    width: '100%',
    flexShrink: 1,
    marginTop: 18,
    justifyContent: 'center',
    marginLeft: 'auto',
    marginRight: 'auto',
    // ...makeDebugBorder('pink'),
  },
  buttonContainer: {
    display: 'flex',
    flexDirection: 'row',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  buttonInner: { width: '100%', height: '100%' },
  button: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderColor: colors['neutral-line'],
    borderWidth: 1,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textDisconnect: {
    color: colors['neutral-body'],
    fontSize: 16,
    fontWeight: '500',
  },
}));
