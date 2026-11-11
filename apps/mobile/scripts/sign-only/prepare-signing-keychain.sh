#!/usr/bin/env bash
# Create an ephemeral signing keychain for one CI job, hide the operator login
# keychain from codesign, and remove stale same-name provisioning profiles.
#
# Usage:
#   prepare-signing-keychain.sh <keychain-path> <password-file> \
#     <original-search-list-file> [target-profile-name]
#
# The caller reads <password-file> to populate MATCH_KEYCHAIN_PASSWORD and
# passes <keychain-path> as MATCH_KEYCHAIN_NAME. Cleanup is handled by
# cleanup-signing-keychain.sh.
set -euo pipefail

KEYCHAIN_PATH="${1:?keychain path is required}"
PASSWORD_FILE="${2:?password file is required}"
ORIG_LIST_FILE="${3:?original search list file is required}"
TARGET_PROFILE="${4:-}"

KEYCHAIN_PASS="$(openssl rand -base64 24)"

if [ -e "$KEYCHAIN_PATH" ]; then
  security delete-keychain "$KEYCHAIN_PATH" 2>/dev/null || true
fi
security create-keychain -p "$KEYCHAIN_PASS" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 3600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASS" "$KEYCHAIN_PATH"

umask 077
printf '%s\n' "$KEYCHAIN_PASS" > "$PASSWORD_FILE"

# Hide the operator login keychain (which may hold stale/revoked duplicate
# identities) for the duration of this job.
security list-keychains -d user \
  | sed -e 's/^[[:space:]]*"//' -e 's/"$//' \
  > "$ORIG_LIST_FILE"
# Keep the System keychain in the search list: it holds the Apple WWDR
# intermediate CA certificates. With only the ephemeral keychain listed,
# fastlane cannot find them and tries to download/install the WWDR itself,
# which fails on the mobile-local runner ("Could not install WWDR certificate").
security list-keychains -d user -s "$KEYCHAIN_PATH" /Library/Keychains/System.keychain

# fastlane's match looks the WWDR intermediates up in the first keychain of the
# user search list (this ephemeral one) and falls back to downloading them from
# apple.com, which fails on the mobile-local runner. Copy the CA certificates
# that already exist in the System keychain instead.
WWDR_PEM="$(mktemp -t wwdr)"
if security find-certificate -a -c "Apple Worldwide Developer Relations" -p /Library/Keychains/System.keychain > "$WWDR_PEM" 2>/dev/null && [ -s "$WWDR_PEM" ]; then
  security import "$WWDR_PEM" -k "$KEYCHAIN_PATH" -T /usr/bin/codesign >/dev/null 2>&1 || true
fi
rm -f "$WWDR_PEM"

if [ -n "$TARGET_PROFILE" ]; then
  python3 - "$TARGET_PROFILE" <<'PY'
import glob, os, plistlib, subprocess, sys

target = sys.argv[1]
dirs = [
    os.path.expanduser('~/Library/MobileDevice/Provisioning Profiles'),
    os.path.expanduser('~/Library/Developer/Xcode/UserData/Provisioning Profiles'),
]
removed = 0
for profile_dir in dirs:
    for path in glob.glob(os.path.join(profile_dir, '*.mobileprovision')):
        raw = subprocess.run(
            ['security', 'cms', '-D', '-i', path], capture_output=True
        ).stdout
        try:
            plist = plistlib.loads(raw)
        except Exception:
            continue
        if plist.get('Name') == target:
            os.remove(path)
            removed += 1
print(f'removed {removed} stale {target} profile(s)')
PY
fi
