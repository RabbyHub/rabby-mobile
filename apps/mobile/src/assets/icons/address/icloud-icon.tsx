import { useThemeColors } from '@/hooks/theme';
import { Svg, Rect, Path } from 'react-native-svg';

export const ICloudIcon = () => {
  const colors = useThemeColors();

  return (
    <Svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <Rect width="32" height="32" rx="16" fill={colors['neutral-card2']} />
      <Path
        d="M22.2614 22.8588H9.73969C7.50366 22.8588 5.71484 21.0302 5.71484 18.7445C5.71484 17.0074 6.78814 15.4531 8.39807 14.8588C8.39807 13.2131 9.69497 11.8874 11.3049 11.8874C11.8863 11.8874 12.4229 12.0702 12.9148 12.3902C13.7645 10.4245 15.6428 9.14453 17.7894 9.14453C20.7409 9.14453 23.1558 11.6131 23.1558 14.6302C23.1558 14.676 23.1558 14.7217 23.1558 14.7217C24.9894 15.1331 26.2863 16.7788 26.2863 18.7445C26.2863 21.0302 24.4975 22.8588 22.2614 22.8588ZM11.3049 12.8017C10.1869 12.8017 9.29248 13.716 9.29248 14.8588C9.29248 14.9502 9.29248 15.0417 9.29248 15.1331L9.38192 15.5445L8.97944 15.636C7.5931 16.0017 6.60925 17.2817 6.60925 18.7445C6.60925 20.5274 7.99559 21.9445 9.73969 21.9445H22.2614C24.0055 21.9445 25.3919 20.5274 25.3919 18.7445C25.3919 17.1445 24.1844 15.7731 22.6192 15.5902L22.172 15.5445L22.2167 15.0874C22.2167 14.9502 22.2167 14.8131 22.2167 14.6302C22.2167 12.116 20.2043 10.0588 17.7447 10.0588C15.777 10.0588 14.0776 11.3388 13.4962 13.2588L13.2726 13.9902L12.736 13.4417C12.3782 13.0302 11.8416 12.8017 11.3049 12.8017Z"
        fill={colors['neutral-body']}
        stroke={colors['neutral-body']}
        strokeWidth="0.685714"
      />
    </Svg>
  );
};
