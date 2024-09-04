import { useThemeColors } from '@/hooks/theme';
import { Svg, Rect, Path } from 'react-native-svg';

export const ManualIcon = () => {
  const colors = useThemeColors();

  return (
    <Svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <Rect width="32" height="32" rx="16" fill={colors['neutral-card2']} />
      <Path
        d="M22.6655 15.5847V11.8347L18.9154 7.66797H10.1654C9.70513 7.66797 9.33203 8.04107 9.33203 8.50131V23.5014C9.33203 23.9617 9.70513 24.3348 10.1654 24.3348H15.1654"
        stroke={colors['neutral-body']}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19.3346 24.3334L23.5013 20.1667L21.8347 18.5L17.668 22.6667V24.3334H19.3346Z"
        stroke={colors['neutral-body']}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.5 7.66797V11.8347H22.6667"
        stroke={colors['neutral-body']}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
