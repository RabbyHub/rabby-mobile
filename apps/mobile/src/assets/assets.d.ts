type Styles = Record<string, string>;

declare module '*.svg' {
  import type { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

declare module '*.png' {
  import { ImageSourcePropType } from 'react-native';
  const content: ImageSourcePropType;
  export default content;
}

declare module '*.jpg' {
  import { ImageSourcePropType } from 'react-native';
  const content: ImageSourcePropType;
  export default content;
}

// declare module '*.md' {
//   const content: string;
//   export default content;
// }

type MemoziedAppSvgIcon = React.MemoExoticComponent<
  (props: any) => React.JSX.Element
>;
