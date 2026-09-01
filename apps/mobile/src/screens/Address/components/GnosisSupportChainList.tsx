import { Text } from '@/components';
import { Chain } from '@/constant/chains';
import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, LayoutChangeEvent, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';

type RNViewProps = {
  style?: import('react').ComponentProps<typeof View>['style'];
  className?: string;
};

export const GnosisSupportChainList = ({
  data,
  style,
}: {
  data: Chain[];
} & RNViewProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();

  const MAX_ROWS = 2;
  const ITEM_HEIGHT = 32;
  const ROW_GAP = 8;

  const [visibleCount, setVisibleCount] = React.useState<number | null>(null);
  const itemYPositions = React.useRef<Map<number, number>>(new Map());

  React.useEffect(() => {
    setVisibleCount(null);
    itemYPositions.current.clear();
  }, [data]);

  const handleItemLayout = (index: number) => (event: LayoutChangeEvent) => {
    const y = event.nativeEvent.layout.y;
    itemYPositions.current.set(index, y);

    if (index === data.length - 1) {
      const maxRowY = (MAX_ROWS - 1) * (ITEM_HEIGHT + ROW_GAP);
      let lastItemInMaxRows = data.length;

      for (let i = 0; i < data.length; i++) {
        const posY = itemYPositions.current.get(i);
        if (posY !== undefined && posY > maxRowY) {
          lastItemInMaxRows = i;
          break;
        }
      }

      if (lastItemInMaxRows < data.length) {
        setVisibleCount(Math.max(1, lastItemInMaxRows - 1));
      }
    }
  };

  const displayData =
    visibleCount !== null ? data.slice(0, visibleCount) : data;
  const showEllipsis = visibleCount !== null;

  return (
    <View style={[styles.chainListContainer, style]}>
      <Text style={styles.chainListDesc}>
        {t('page.importSafe.gnosisChainPillDesc')}
      </Text>
      <View style={styles.chainList}>
        {displayData.map((chain, index) => (
          <View
            key={chain.id}
            style={styles.chainPill}
            onLayout={
              visibleCount === null ? handleItemLayout(index) : undefined
            }>
            <Image source={{ uri: chain.logo }} style={styles.chainLogo} />
            <Text style={styles.chainName}>{chain.name}</Text>
          </View>
        ))}
        {showEllipsis && (
          <View style={styles.chainPill}>
            <Text style={styles.ellipsisText}>...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  chainListContainer: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  chainListDesc: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  chainList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    borderRadius: 8,
    padding: 6,
    height: 32,
  },
  chainLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  chainName: {
    fontSize: 14,
    fontWeight: '500',
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
  },
  ellipsisText: {
    fontSize: 14,
    fontWeight: '500',
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
  },
}));
