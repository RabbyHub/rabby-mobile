import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { OpenedDappItem } from '../../hooks/useDappView';
import { useThemeColors } from '@/hooks/theme';
import { DappCardInWebViewNav } from '../../components/DappCardInWebViewNav';
import { Button } from '@/components';
import { useDapps } from '@/hooks/useDapps';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';

export function BottomSheetContent({
  dappInfo,
  bottomNavBar,
  onPressCloseDapp,
}: {
  dappInfo?: OpenedDappItem | null;
  bottomNavBar: React.ReactNode;
  onPressCloseDapp?: () => void;
}) {
  const colors = useThemeColors();

  const { updateFavorite, addDapp } = useDapps();

  const styles = React.useMemo(() => {
    return getStyle(colors);
  }, [colors]);

  if (!dappInfo) return null;

  return (
    <View>
      {dappInfo?.maybeDappInfo && (
        <BottomSheetScrollView style={{ minHeight: 108 }}>
          <DappCardInWebViewNav
            data={dappInfo.maybeDappInfo}
            onFavoritePress={dapp => {
              updateFavorite(dapp.origin, !dapp.isFavorite);
            }}
          />
        </BottomSheetScrollView>
      )}

      <View style={styles.container}>
        <View style={{ flexShrink: 0 }}>{bottomNavBar}</View>
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
    paddingVertical: 16,
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  buttonWrapper: {
    width: '100%',
    flexShrink: 1,
    marginTop: 18,
    paddingHorizontal: 20,
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
