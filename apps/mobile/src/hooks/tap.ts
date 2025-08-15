import { useRef, useCallback } from 'react';

/**
 * Custom hook to detect multiple presses within a specified timeout.
 * @param requiredPresses - Number of presses required to trigger the callback (e.g., 10).
 * @param timeout - Maximum interval between presses (in milliseconds) before resetting the count.
 * @param onMultiPress - Callback function to execute when the required number of presses is reached.
 */
export function useMultiPress({
  requiredPresses = 10,
  timeout = 300,
  onMultiPress,
}: {
  requiredPresses?: number;
  timeout?: number;
  onMultiPress?: () => void;
}) {
  const pressCountRef = useRef(0);
  const lastPressTimeRef = useRef(0);

  const handlePress = useCallback(() => {
    const now = Date.now();
    const timeDiff = now - lastPressTimeRef.current;

    // If the time difference between two presses is less than the timeout, increment the count; otherwise, reset it.
    if (timeDiff < timeout) {
      pressCountRef.current += 1;
    } else {
      pressCountRef.current = 1;
    }

    lastPressTimeRef.current = now;

    // This condition checks if the required number of presses has been reached.
    if (pressCountRef.current >= requiredPresses) {
      onMultiPress?.();
      pressCountRef.current = 0; // Optional: Whether to reset after triggering
    }
  }, [requiredPresses, timeout, onMultiPress]);

  return { handlePress };
}
