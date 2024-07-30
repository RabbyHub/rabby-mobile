import React from 'react';
import { ImageProps } from 'react-native';
import { SvgXml } from 'react-native-svg';

export const TestnetChainLogo = ({
  size = 20,
  name,
  ...props
}: React.PropsWithoutRef<
  Omit<ImageProps, 'source'> & {
    size?: number;
    name: string;
  }
>) => {
  const xml = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='#6A7587'></circle><text x='16' y='20' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='12' line-height='12' font-weight='400'>${encodeURIComponent(
    name.substring(0, 3).replace(/\s/g, ''),
  )}</text></svg>`;

  return (
    <SvgXml
      xml={xml}
      width={size}
      height={size}
      style={[{ height: size, width: size }, props.style]}
    />
  );
};
