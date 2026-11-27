#!/usr/bin/env bash
# Sign a verified unsigned AAB.
#
# The signer never builds: it takes the artifact produced by a `unsigned:android`
# build, re-checks it against the attestation(s), and only then signs. This is
# the step that turns a reproduced artifact into a releasable one.
#
#   bash scripts/unsigned/sign-android.sh \
#     dist/unsigned/production/app-release-unsigned.aab \
#     --attest dist/unsigned/production/attest.json \
#     [--peer-attest /path/to/other-machine/attest.json] \
#     [--out dist/unsigned/production/app-release.aab]
#
# Credentials come from the environment, exactly like the existing release flow:
#   RABBY_MOBILE_ANDROID_KEY_STORE        base64 keystore (or a path when not base64)
#   RABBY_MOBILE_ANDROID_STORE_PASSWORD
#   RABBY_MOBILE_ANDROID_KEY_PASSWORD
#   RABBY_MOBILE_ANDROID_KEY_ALIAS
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"

artifact=""
attest=""
peer_attest=""
out=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --attest) attest="$2"; shift 2 ;;
    --peer-attest) peer_attest="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    -h|--help) sed -n '3,20p' "$0"; exit 0 ;;
    *) artifact="$1"; shift ;;
  esac
done

[ -n "$artifact" ] && [ -f "$artifact" ] || { echo "usage: $0 <unsigned.aab> --attest <attest.json>" >&2; exit 2; }
[ -n "$attest" ] && [ -f "$attest" ] || { echo "[sign] --attest is required (the build attestation)" >&2; exit 2; }
[ -n "$out" ] || out="${artifact%-unsigned.aab}.aab"
[ "$out" = "$artifact" ] && { echo "[sign] refusing to overwrite the unsigned input" >&2; exit 2; }

sha256_of() { shasum -a 256 "$1" | awk '{print $1}'; }

actual="$(sha256_of "$artifact")"
expected="$(node -e 'const fs=require("fs");const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write((a.artifact&&a.artifact.sha256)||"")' "$attest")"
if [ -z "$expected" ]; then
  echo "[sign] $attest has no artifact.sha256" >&2
  exit 1
fi
if [ "$actual" != "$expected" ]; then
  echo "[sign] artifact does not match its attestation" >&2
  echo "       expected $expected" >&2
  echo "       actual   $actual" >&2
  exit 1
fi
echo "[sign] artifact matches attest: $actual"

if [ -n "$peer_attest" ]; then
  node "$script_dir/compare.mjs" "$attest" "$peer_attest"
else
  echo "[sign] no --peer-attest given; skipping the second-builder comparison"
fi

for required in RABBY_MOBILE_ANDROID_KEY_STORE RABBY_MOBILE_ANDROID_STORE_PASSWORD RABBY_MOBILE_ANDROID_KEY_PASSWORD RABBY_MOBILE_ANDROID_KEY_ALIAS; do
  [ -n "${!required:-}" ] || { echo "[sign] $required is required" >&2; exit 2; }
done

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

keystore="$RABBY_MOBILE_ANDROID_KEY_STORE"
if [ -f "$keystore" ]; then
  echo "[sign] using keystore file"
else
  printf '%s\n' "$RABBY_MOBILE_ANDROID_KEY_STORE" | base64 -d > "$tmp_dir/upload.jks"
  chmod 600 "$tmp_dir/upload.jks"
  keystore="$tmp_dir/upload.jks"
fi

cp "$artifact" "$out"
jarsigner \
  -keystore "$keystore" \
  -storepass "$RABBY_MOBILE_ANDROID_STORE_PASSWORD" \
  -keypass "$RABBY_MOBILE_ANDROID_KEY_PASSWORD" \
  -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  "$out" "$RABBY_MOBILE_ANDROID_KEY_ALIAS" >/dev/null

jarsigner -verify "$out" >/dev/null
echo "[sign] signature verified"

signed_sha="$(sha256_of "$out")"
node -e '
const fs=require("fs");
const [attestPath, unsignedSha, signedSha, alias, outPath] = process.argv.slice(1);
const attest=JSON.parse(fs.readFileSync(attestPath,"utf8"));
const record={
  schemaVersion:1,
  platform:"android",
  channel:attest.channel,
  commit:attest.commit,
  unsigned:{sha256:unsignedSha},
  signed:{path:outPath,sha256:signedSha},
  key:{alias},
  signer:{host:require("os").hostname(),user:require("os").userInfo().username,signedAt:new Date().toISOString()},
};
fs.writeFileSync(`${outPath}.signed.json`, JSON.stringify(record,null,2)+"\n");
console.log(`[sign] signed ${outPath} (${signedSha})`);
' "$attest" "$actual" "$signed_sha" "$RABBY_MOBILE_ANDROID_KEY_ALIAS" "$out"
