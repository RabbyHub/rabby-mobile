import React from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '@/components2024/Button';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { NewTag } from '../../Home/components/NewTag';

export function ConvertDustEntryGuideModal({
  visible,
  onGotIt,
}: {
  visible: boolean;
  onGotIt: () => void;
}) {
  const { styles } = useTheme2024({ getStyle });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onGotIt}>
      <Pressable style={styles.mask}>
        <Pressable
          style={styles.card}
          onPress={event => event.stopPropagation()}>
          <Text style={styles.title}>
            You can find Convert Dust{'\n'}👇 here on the Homepage
          </Text>

          <View style={styles.preview}>
            <View style={styles.previewGrid}>
              <PreviewTile title="Market" badge="+3.5%" dimmed />
              <PreviewTile title="Approvals" dimmed />
              <PreviewTile title="Rabby Points" badge="456" dimmed />
              <PreviewTile title="Convert Dust" highlight />
            </View>
          </View>

          <Button
            type="primary"
            title="Got it"
            buttonStyle={styles.button}
            titleStyle={styles.buttonText}
            onPress={onGotIt}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PreviewTile({
  title,
  badge,
  dimmed = false,
  highlight = false,
}: {
  title: string;
  badge?: string;
  dimmed?: boolean;
  highlight?: boolean;
}) {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View
      style={[
        styles.previewTile,
        dimmed && styles.previewTileDimmed,
        highlight && styles.previewTileHighlight,
      ]}>
      <View style={styles.previewIcon} />
      {badge ? <Text style={styles.previewBadge}>{badge}</Text> : null}
      <View style={styles.previewTitleRow}>
        <Text style={styles.previewTitle}>{title}</Text>
        {highlight ? <NewTag /> : null}
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  mask: {
    flex: 1,
    paddingHorizontal: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 352,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 32,
    backgroundColor: colors2024['neutral-bg-0'],
    alignItems: 'center',
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
    textAlign: 'center',
  },
  preview: {
    width: 276,
    height: 163,
    marginTop: 16,
    marginBottom: 14,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  previewTile: {
    width: 133,
    height: 77,
    borderRadius: 14,
    padding: 15,
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'space-between',
    shadowColor: 'rgba(25, 28, 30, 0.04)',
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    elevation: 4,
  },
  previewTileDimmed: {
    opacity: 0.3,
  },
  previewTileHighlight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 173,
    height: 100,
    borderRadius: 16,
    padding: 20,
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOpacity: 1,
    shadowRadius: 21,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    elevation: 10,
  },
  previewIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors2024['brand-default-icon'],
  },
  previewBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  button: {
    width: 319,
    height: 56,
    borderRadius: 12,
  },
  buttonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
}));
