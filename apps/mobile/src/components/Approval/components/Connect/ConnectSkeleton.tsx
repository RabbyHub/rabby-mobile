import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { range } from 'lodash';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export const ConnectSkeleton = () => {
  const { colors, styles, colors2024 } = useTheme2024({ getStyle });

  const Linear = useCallback(() => {
    return (
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        // eslint-disable-next-line react-native/no-inline-styles
        style={{ height: '100%' }}
        colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-1']]}
      />
    );
  }, [colors2024]);

  return (
    <View style={styles.connectWrapper}>
      <BottomSheetScrollView style={{ flex: 1 }}>
        <View style={styles.approvalConnect}>
          <View style={styles.titleWrapper}>
            <CustomSkeleton
              // animation="wave"
              LinearGradientComponent={Linear}
              style={styles.approvalTitle}
            />

            <CustomSkeleton
              LinearGradientComponent={Linear}
              style={styles.chainSelector}
            />
          </View>
        </View>

        <View style={styles.connectContent}>
          <View style={styles.connectCard}>
            <CustomSkeleton
              LinearGradientComponent={Linear}
              style={styles.dappIcon}
            />

            <CustomSkeleton
              LinearGradientComponent={Linear}
              style={styles.connectOrigin}
            />
          </View>

          <View style={styles.ruleList}>
            {range(0, 4).map(item => {
              return (
                <View style={styles.ruleListItem} key={item}>
                  <CustomSkeleton
                    LinearGradientComponent={Linear}
                    style={styles.label}
                  />
                  <CustomSkeleton
                    LinearGradientComponent={Linear}
                    style={styles.value}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </BottomSheetScrollView>

      <View style={styles.footerContainer}>
        <View style={styles.connectWalletRow}>
          <CustomSkeleton
            LinearGradientComponent={Linear}
            style={styles.connectWalletLabel}
          />
          <CustomSkeleton
            LinearGradientComponent={Linear}
            style={styles.connectWalletValue}
          />
        </View>
        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <CustomSkeleton
              LinearGradientComponent={Linear}
              style={styles.btn}
            />
          </View>
          <View style={styles.footerItem}>
            <CustomSkeleton
              LinearGradientComponent={Linear}
              style={styles.btn}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  connectWrapper: {
    height: '100%',
    flexDirection: 'column',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    display: 'flex',
  },
  approvalConnect: {
    marginHorizontal: 16,
    paddingLeft: 8,
    marginBottom: 16,
    marginTop: 30,
  },
  approvalTitle: {
    width: 130,
    height: 22,
    borderRadius: 4,
  },
  chainSelector: {
    width: 117,
    height: 24,
    borderRadius: 4,
  },

  connectContent: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    marginHorizontal: 16,
  },
  connectCard: {
    padding: 23,
    alignItems: 'center',
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
  },
  connectOrigin: {
    height: 22,
    width: 117,
    borderRadius: 4,
  },
  ruleList: {
    flex: 1,
  },
  ruleListItem: {
    padding: 16,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    width: 100,
    height: 20,
    borderRadius: 4,
  },
  value: {
    width: 50,
    height: 20,
    borderRadius: 4,
  },
  footerContainer: {
    paddingTop: 16,
    paddingBottom: 56,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  footer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  footerItem: {
    flex: 1,
  },
  connectWalletRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 24,
  },
  btn: {
    width: '100%',
    height: 56,
    borderRadius: 4,
  },
  connectWalletLabel: {
    width: 106,
    height: 20,
    borderRadius: 4,
  },
  connectWalletValue: {
    width: 118,
    height: 32,
    borderRadius: 4,
  },

  titleWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dappIcon: { width: 44, height: 44, borderRadius: 4, marginBottom: 8 },
}));
