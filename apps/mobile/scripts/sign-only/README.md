# Sign-only packages

Build an unsigned package locally, upload it to the fe-opcode private artifact
broker, then let the `Sign Only Package` GitHub Actions workflow perform only
the signing, CDN publish and optional Lark notification.

## Android

```bash
bash scripts/sign-only/build-unsigned-android.sh
```

Output: `.sign-only/app-signonly-unsigned.apk`.

## iOS

Install Pods first if `ios/Pods` is missing:

```bash
yarn ios:installpod
bash scripts/sign-only/build-unsigned-ios.sh
```

Output: `.sign-only/RabbyMobile.xcarchive.zip`.

## Upload and trigger

The upload endpoint needs a fe-opcode JWT. The dashboard stores one in
`localStorage` after login; the JWT login tab can also produce one. Keep it in
an ignored local environment variable rather than command history.

```bash
export OPFE_SIGN_ONLY_SERVICE_URL=https://rabby-fe-opcode-service.dbkops.com
export OPFE_SIGN_ONLY_TOKEN='<fe-opcode JWT>'

node scripts/sign-only/publish.mjs \
  --platform android \
  --file .sign-only/app-signonly-unsigned.apk \
  --source-sha "$(git rev-parse HEAD)" \
  --prepare
```

The command prints a `gh workflow run ...` command. Run that command yourself
with your own GitHub identity; fe-opcode does not store a GitHub token or
trigger workflows on your behalf. Add `--notify-lark` to generate inputs that
push the signed package to the CI/CD Lark group after signing. Without it, the
package is signed and published to the regression CDN but no Lark message is
sent.

The same flow is available from the `仅签名打包` page in the fe-opcode
dashboard, including the Lark notification toggle.
