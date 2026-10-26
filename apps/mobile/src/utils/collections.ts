interface IsLikelyScamCollectionProps {
  is_verified?: boolean | null;
}
export const isValidCollection = (collection?: IsLikelyScamCollectionProps) => {
  // 明确标记的才处理
  if (collection?.is_verified === false) {
    return false;
  }
  return true;
};
