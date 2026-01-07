import {
  FOLD_ASSETS_HEADER_HEIGHT,
  UNFOLD_ASSETS_HEADER_HEIGHT,
  TAB_HEADER_HEIGHT,
} from '@/constant/layout';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useMemo } from 'react';

export const BG_FULL_HEIGHT = 560;
export const useBgSize = () => {
  const { safeTop, safeOffHeader } = useSafeSizes();

  const sizes = useMemo(() => {
    const topHeight = safeOffHeader - 11;
    const centerFoldHeight = FOLD_ASSETS_HEADER_HEIGHT;
    const centerUnfoldHeight = UNFOLD_ASSETS_HEADER_HEIGHT;
    const endHeight = TAB_HEADER_HEIGHT;

    const layouts = {
      fold: {
        top: {
          height: topHeight,
          top: 0,
        },
        center: {
          height: centerFoldHeight,
          top: 0 - topHeight,
        },
        end: {
          height: endHeight,
          top: 0 - topHeight - centerFoldHeight,
        },
      },
      unfold: {
        top: {
          height: topHeight,
          top: 0,
        },
        center: {
          height: centerUnfoldHeight,
          top: 0 - topHeight,
        },
        end: {
          height: endHeight,
          top: 0 - topHeight - centerUnfoldHeight,
        },
      },
    };

    return {
      safeTop,
      layouts,
      bgFullHeight: BG_FULL_HEIGHT,
      topHeight,
    };
  }, [safeTop, safeOffHeader]);
  return sizes;
};
