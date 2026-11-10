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

The signing workflow only accepts artifacts whose SHA-256 matches the value
recorded by fe-opcode, only downloads from the sign-only broker URL, and
refuses packages built from a dirty source tree. Pass `--source-clean` to
`publish.mjs` / `one-shot.mjs` only when you intentionally build from a dirty
tree.

The same flow is available from the `仅签名打包` page in the fe-opcode
dashboard, including the Lark notification toggle.

## One-shot: build -> cloud sign -> Lark

```bash
yarn sign-only:full:android   # build + upload + trigger + wait
yarn sign-only:full:ios       # macOS only; run `yarn ios:installpod` first
yarn sign-only:full:all       # Android then iOS, sequential
```

The script:

1. builds the unsigned package with the same preparation as feature test;
2. uploads it to fe-opcode and prepares the signing request;
3. triggers the `Sign Only Package` workflow with `notify_lark=true` (default);
4. waits for the cloud signing job and prints the signed CDN URL.

The Lark message is sent by the cloud workflow **after signing**, never by the
local script. Invoke the script directly when passing flags:

```bash
node apps/mobile/scripts/sign-only/one-shot.mjs --platform android --no-notify-lark
```

Requirements: `OPFE_SIGN_ONLY_TOKEN` (or `~/.config/opfe/sign-only-token`) and
an authenticated `gh` (`gh auth login`).

`workflow_dispatch` only works once `sign_only_package.yml` is on the default
branch. Until then the script bakes the inputs into a temporary `test/*`
branch, triggers the workflow's push path and deletes the branch afterwards.

## Upload through a proxy

`publish.mjs` PUTs the artifact directly to a presigned S3 URL. When the direct
cross-border upload is too slow, route only that upload through an HTTP proxy:

```bash
node apps/mobile/scripts/sign-only/publish.mjs \
  --platform android \
  --file .sign-only/app-signonly-unsigned.apk \
  --prepare --proxy http://127.0.0.1:7890

# or for the one-shot command
node apps/mobile/scripts/sign-only/one-shot.mjs \
  --platform android --proxy http://127.0.0.1:7890
```

`OPFE_SIGN_ONLY_PROXY` works as the environment-variable equivalent. The proxy
must accept HTTP `CONNECT`; credentials in the URL are supported.

Run the proxy upload test with:

```bash
yarn sign-only:test
```
