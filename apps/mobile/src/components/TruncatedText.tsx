import React from 'react';
import { Text, TextProps } from 'react-native';

/**
 * if the text is truncated, call onTruncate with true, otherwise call with false
 */
export const TruncatedText: React.FC<
  TextProps & {
    numberOfLines: number;
    onTruncate?(isTruncated: boolean): void;
    text?: string;
  }
> = ({ text, onTruncate, ...props }) => {
  const [hasTested, setHasTested] = React.useState<boolean>(false);
  const [testFlag, setTestFlag] = React.useState('');
  const lastLineWidthRef = React.useRef<number>(0);

  const handleTextLayout = (event: any) => {
    props.onTextLayout?.(event);
    const { lines } = event.nativeEvent;
    console.log('lines', lines);
    const lastLineWidth = lines[props.numberOfLines - 1]?.width;
    if (lastLineWidthRef.current === lastLineWidth) {
      onTruncate?.(true);
    } else {
      onTruncate?.(false);
    }
    lastLineWidthRef.current = lastLineWidth;
  };

  React.useEffect(() => {
    setHasTested(false);
  }, [text]);

  React.useEffect(() => {
    if (!text) {
      return;
    }
    setTimeout(() => {
      if (!hasTested) {
        setTestFlag(' ');
        setHasTested(true);
      } else {
        setTestFlag('');
      }
    }, 10);
  }, [hasTested, text, props.numberOfLines]);

  return (
    <Text {...props} onTextLayout={handleTextLayout}>
      {text}
      {testFlag}
    </Text>
  );
};
