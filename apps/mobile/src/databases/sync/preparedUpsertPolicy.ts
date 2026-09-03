type PreparedUpsertPolicyOptions = {
  isDev: boolean;
  isNonPublicProductionEnv: boolean;
  onlineDisablePreparedUpsert: unknown;
};

export function shouldDisablePreparedUpsert({
  isDev,
  isNonPublicProductionEnv,
  onlineDisablePreparedUpsert,
}: PreparedUpsertPolicyOptions) {
  return (
    !isDev && !isNonPublicProductionEnv && onlineDisablePreparedUpsert === true
  );
}
