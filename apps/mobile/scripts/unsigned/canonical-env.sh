#!/usr/bin/env bash
# Canonical environment for an unsigned (reproducible) mobile build.
#
# Ambient RABBY_MOBILE_* variables from shell profiles or CI leak into the JS
# bundle through babel's dotenv/env inlining, and cache lanes change the native
# outputs. Both builders must therefore start from the same environment: keep
# the business inputs and the unsigned-build controls, drop the rest, then pin
# the debug/cache knobs to their production-safe values.
#
# Usage: . scripts/unsigned/canonical-env.sh && unsigned_apply_canonical_env

unsigned_apply_canonical_env() {
  local ambient
  while IFS= read -r ambient; do
    [ -n "$ambient" ] || continue
    unset "$ambient" || true
  done <<EOF
# Business inputs the bundle script requires (the iOS lane aborts without the
# Korean password, for instance) stay; everything else is builder state.
$(env | sed -n 's/^\(RABBY_MOBILE_[A-Z0-9_]*\)=.*/\1/p' | grep -vE '^RABBY_MOBILE_(CODE|KR_PWD|SAFE_API_KEY|WALLETCONNECT_PROJECT_ID|FE_SERVICE_URL|UNSIGNED_.*|IOS_UNSIGNED_.*|IOS_BUILD_UNSIGNED)$' || true)
EOF

  unset APP_ENV WITH_ROZENITE I18N_LIVE_PREVIEW LOCAL_PACK 2>/dev/null || true

  # Debug/test-only knobs must not leak into a shipped package.
  export RABBY_MOBILE_E2E_SILENT_LOGS=""
  export RABBY_MOBILE_BUILD_DEVTOOLS_PANEL=0
  export RABBY_MOBILE_MODULE_LOADING_MODE=lazy
  export RABBY_MOBILE_METRO_USE_CACHE=false

  # Acceleration/cache lanes are not allowed to shape a shipped artifact.
  export RABBY_MOBILE_TURBO_BUILD=false
  export RABBY_MOBILE_POD_USE_CACHE=false
  export RABBY_MOBILE_NM_USE_CACHE=false
  export RABBY_MOBILE_ANDROID_FAST_BUILD=false
  export RABBY_MOBILE_IOS_FAST_BUILD=false
  export RABBY_MOBILE_IOS_PREBUNDLE_JS=false
}
