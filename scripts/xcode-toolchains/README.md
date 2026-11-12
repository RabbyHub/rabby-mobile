# Private Xcode downloads

`Xcode Toolchain Downloads` is a manual-only workflow. It has no version
inputs: one invocation checks every registered archive, generates S3 GET
links valid for at most one hour, and sends one message to the existing
Feature Test Lark bot. It does not build, install Xcode, or change the
Simulator/Feature Test workflows.

## Provisioning status

The initial Xcode 26.3 (`17C529`, arm64) and 27.1 (`27A9275`, arm64)
archives and manifests have been uploaded with SSE-KMS. Apple signatures,
archive metadata, byte counts, and S3 full-object SHA-256 checksums were
verified before registration. The exact filenames, sizes, digests, and keys
are in [catalog.json](./catalog.json). Empty or invalid catalogs fail before
signing or sending anything.

## Storage and access

Use the existing `RABBY_MOBILE_BUILD_BUCKET` secret and the `mobile-local`
runner's AWS `default` profile. The object layout is:

```text
s3://<bucket>/_private/toolchains/apple/xcode/<version>-<build>-<architecture>-<fullSHA256>/
  <original_XIP_filename>
  manifest.json
```

`_private` is only a key prefix, not an access policy. Before uploading,
verify that neither anonymous S3 access nor an existing CDN origin identity
can read the objects without authorization. An owner-only object ACL,
ordinary SSE-S3 encryption, or `IsPublic: false` alone does not establish
that boundary.

These archives and manifests use per-object **SSE-KMS with the AWS-managed
`alias/aws/s3` key** from their first upload. Legacy CloudFront OAI does not
support SSE-KMS; this isolates these objects from the existing OAI's broad
S3 read grant without changing the bucket policy or existing app downloads.
The download helper requires `ServerSideEncryption=aws:kms` and refuses
missing or downgraded encryption. This is an object-level property, not a
permanent prefix-wide policy: review access again if the CDN or storage
configuration changes. See [AWS's OAI restrictions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
and [SSE-KMS permissions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html).

The notification job does not manage bucket policies or upload archives.
Its IAM requirements are `s3:GetBucketLocation` for the selected bucket and
`s3:GetObject` for the exact archive prefix, plus use of `kms:Decrypt` via
S3 for the chosen key. Same-account access via S3 is supported by the
AWS-managed key policy; validate an actual download, not only HEAD. No
CloudFront management permission is needed. Only the separate provisioning
operation needs `s3:PutObject` and `kms:GenerateDataKey`; multipart upload
also needs `kms:Decrypt`. KMS requests can incur additional charges.
Keep the source archives after upload.

## Register a trusted archive

1. Obtain the XIP directly from Apple. Check `pkgutil --check-signature`,
   require the trusted Apple Software signature, and calculate the full
   file SHA-256 and byte count.
2. Extract the XIP's own `Contents/version.plist` and executable metadata
   to record its Xcode version, `ProductBuildVersion`, and distribution
   architecture. Do not infer the build from the filename or a different
   installed Xcode. For the current arm64 distributions, `architecture`
   describes the main Xcode executable, not every nested binary.
3. Upload to the exact content-addressed key without overwriting an
   existing object, explicitly using `--server-side-encryption aws:kms
--ssekms-key-id alias/aws/s3` from the first upload. Set S3 user metadata
   `sha256` to the full lowercase file digest. Verify SSE-KMS and the actual
   managed key identity in the upload receipt. Verify the complete uploaded
   bytes using S3's validated
   full-object SHA-256 or a full read-back hash. A multipart ETag, a
   composite checksum, and user metadata alone are not full-file proof.
4. Write `manifest.json` beside the archive and add the same entry to the
   reviewed Git catalog only after verification. The manifest contains
   `schemaVersion: 1` and `entry` with the fields below. It contains neither
   credentials nor a signed URL. Encrypt the manifest the same way as the
   XIP. The Git catalog, not a mutable S3 listing
   or manifest, is the download job's allowlist and expected digest.
5. Validate the catalog and run the local tests before committing. Adding
   a version is an explicit reviewed change; the job never signs arbitrary
   paths or discovers every object in the bucket.

Each catalog entry contains:

| Field          | Value                                                             |
| -------------- | ----------------------------------------------------------------- |
| `version`      | Xcode version from the archive, e.g. `27.1`                       |
| `build`        | Apple build identifier from the archive                           |
| `architecture` | `arm64` or `universal`, verified from the archive                 |
| `filename`     | Original `Xcode_*.xip` filename                                   |
| `bytes`        | Exact full file size                                              |
| `sha256`       | Full lowercase, 64-character file SHA-256                         |
| `key`          | Exact object key matching the layout above; no bucket or URL      |
| `uploadedAt`   | S3 object LastModified in UTC; registered only after verification |
| `source`       | `https://developer.apple.com/download/all/`                       |
| `signature`    | `Apple Software` after signature verification                     |

The current bucket uses unversioned objects. If versioning is enabled,
do not silently omit the returned version ID: this implementation refuses
version-pinned signing because AWS CLI `s3 presign` cannot sign a
`versionId` parameter. Add and test a signer with explicit version support
before registering versioned archives.

## Delivery and verification

The helper checks every object's size and SHA-256 metadata against the
Git catalog and requires SSE-KMS before signing anything. It uses the bucket's actual AWS
region, TLS-verified AWS endpoints, and `--expires-in 3600`. A missing or
mismatched object aborts the entire notification; no partial list is sent.

Signed URLs remain in process memory and the Lark message body. They are
not put in workflow outputs, summaries, artifacts, or command logs. The
message includes version/build/architecture, filename, byte count, full
SHA-256, and expiration in UTC. It uses the same webhook secret names and
fallbacks as Feature Test. A failed or ambiguous notification is not
automatically retried; check delivery before running it again.

A presigned URL is a reusable bearer link until expiry, not a one-time
download or a bandwidth quota. Do not forward it to public channels.
Temporary AWS credentials can shorten the effective lifetime below one
hour. Recipients must compare the downloaded file against the digest in
the reviewed catalog/message and verify its Apple signature before
extracting or installing it. The HEAD metadata check does not replace
that full-byte validation.

```bash
shasum -a 256 /path/to/downloaded/Xcode_archive.xip
pkgutil --check-signature /path/to/downloaded/Xcode_archive.xip
```

## Tests

No Yarn install or native build is required; the helper and shared sender
use Node's built-in modules.

```bash
node --test scripts/xcode-toolchains/download-links.test.mjs scripts/ios-startup-smoke/notify.test.mjs
```

These tests exercise validation, AWS command contracts, the shared Lark
sender, and CLI output with mocked external boundaries. They do not prove
real S3 permissions, an actual upload, or actual Lark delivery.
