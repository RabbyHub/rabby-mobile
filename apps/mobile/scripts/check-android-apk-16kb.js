#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const SIXTEEN_KB = 16 * 1024;
const SIXTY_FOUR_BIT_ABIS = new Set(['arm64-v8a', 'x86_64']);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function pathExists(filePath) {
  return !!filePath && fs.existsSync(filePath);
}

function versionParts(value) {
  return String(value)
    .split(/[.-]/)
    .map(part => {
      const numeric = Number.parseInt(part, 10);
      return Number.isFinite(numeric) ? numeric : 0;
    });
}

function compareVersionLike(a, b) {
  const aa = versionParts(a);
  const bb = versionParts(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const diff = (aa[i] || 0) - (bb[i] || 0);
    if (diff) {
      return diff;
    }
  }
  return 0;
}

function listDirectories(dirPath) {
  if (!pathExists(dirPath)) {
    return [];
  }
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(dirPath, entry.name));
}

function findLatestZipalign(sdkRoots) {
  const candidates = [];
  for (const sdkRoot of sdkRoots) {
    const buildToolsDir = path.join(sdkRoot, 'build-tools');
    for (const versionDir of listDirectories(buildToolsDir)) {
      const zipalign = path.join(versionDir, 'zipalign');
      if (pathExists(zipalign)) {
        candidates.push({
          version: path.basename(versionDir),
          path: zipalign,
        });
      }
    }
  }

  candidates.sort((a, b) => compareVersionLike(a.version, b.version));
  return candidates.at(-1)?.path || null;
}

function collectNdkRoots(sdkRoots) {
  const roots = unique([
    process.env.ANDROID_NDK_HOME,
    process.env.ANDROID_NDK_ROOT,
    process.env.NDK_HOME,
    ...sdkRoots.flatMap(sdkRoot => [
      path.join(sdkRoot, 'ndk-bundle'),
      ...listDirectories(path.join(sdkRoot, 'ndk')),
    ]),
  ]).filter(pathExists);

  roots.sort((a, b) => compareVersionLike(path.basename(a), path.basename(b)));
  return roots;
}

function findLatestLlvmObjdump(sdkRoots) {
  const candidates = [];
  for (const ndkRoot of collectNdkRoots(sdkRoots)) {
    const prebuiltDir = path.join(ndkRoot, 'toolchains', 'llvm', 'prebuilt');
    for (const hostDir of listDirectories(prebuiltDir)) {
      const llvmObjdump = path.join(hostDir, 'bin', 'llvm-objdump');
      if (pathExists(llvmObjdump)) {
        candidates.push({
          version: path.basename(ndkRoot),
          path: llvmObjdump,
        });
      }
    }
  }

  candidates.sort((a, b) => compareVersionLike(a.version, b.version));
  return candidates.at(-1)?.path || null;
}

function runTool(file, args, options = {}) {
  const result = spawnSync(file, args, {
    encoding: options.encoding || 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  return {
    ok: result.status === 0,
    status: result.status,
    stdout,
    stderr,
    output: [stdout, stderr].filter(Boolean).join('\n'),
  };
}

function runZipalign(zipalignPath, apkPath) {
  const result = runTool(zipalignPath, ['-c', '-P', '16', '-v', '4', apkPath]);
  return {
    ok: result.ok,
    command: `${zipalignPath} -c -P 16 -v 4 ${apkPath}`,
    outputTail: result.output.split('\n').slice(-40).join('\n'),
  };
}

function listApkSharedObjects(apkPath) {
  const output = execFileSync('unzip', ['-Z1', apkPath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(entry => /^lib\/[^/]+\/[^/]+\.so$/.test(entry));
}

function extractApkEntry(apkPath, entry, targetDir) {
  const targetPath = path.join(targetDir, entry);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const content = execFileSync('unzip', ['-p', apkPath, entry], {
    encoding: 'buffer',
    maxBuffer: 512 * 1024 * 1024,
  });
  fs.writeFileSync(targetPath, content);
  return targetPath;
}

function parseLoadAlignValue(value) {
  if (value.startsWith('2**')) {
    return 1 << Number.parseInt(value.slice(3), 10);
  }
  if (value.startsWith('0x')) {
    return Number.parseInt(value, 16);
  }
  return Number.parseInt(value, 10);
}

function inspectElfLoadAlignments(llvmObjdumpPath, soPath) {
  const output = execFileSync(llvmObjdumpPath, ['-p', soPath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const loadAligns = [];
  for (const line of output.split('\n')) {
    const match = line.match(/^\s*LOAD\s.*\balign\s+(\S+)\s*$/);
    if (match) {
      const raw = match[1];
      loadAligns.push({
        raw,
        value: parseLoadAlignValue(raw),
      });
    }
  }
  const minLoadAlign = Math.min(...loadAligns.map(item => item.value));
  return {
    loadAligns,
    minLoadAlign: Number.isFinite(minLoadAlign) ? minLoadAlign : 0,
  };
}

function inspectSharedObjects({ apkPath, llvmObjdumpPath }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rabby-apk-16kb-'));
  const rows = [];

  try {
    for (const entry of listApkSharedObjects(apkPath)) {
      const [, abi, lib] = entry.split('/');
      const soPath = extractApkEntry(apkPath, entry, tempDir);
      const alignInfo = inspectElfLoadAlignments(llvmObjdumpPath, soPath);
      const is64Bit = SIXTY_FOUR_BIT_ABIS.has(abi);
      rows.push({
        abi,
        lib,
        entry,
        is64Bit,
        minLoadAlign: alignInfo.minLoadAlign,
        loadAligns: alignInfo.loadAligns.map(item => item.raw),
        ok: alignInfo.minLoadAlign >= SIXTEEN_KB,
      });
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return rows;
}

function summarizeFailures(failures, limit = 4) {
  if (!failures.length) {
    return '';
  }
  const names = failures
    .slice(0, limit)
    .map(item => `${item.abi}/${item.lib} align=${item.minLoadAlign}`);
  const more =
    failures.length > limit ? `, +${failures.length - limit} more` : '';
  return `${names.join(', ')}${more}`;
}

function makeReport({ apkPath, zipalign, elfRows, tools, mode, error }) {
  const failed64Bit = elfRows.filter(item => item.is64Bit && !item.ok);
  const failed32Bit = elfRows.filter(item => !item.is64Bit && !item.ok);
  const status = error
    ? 'error'
    : zipalign.ok && failed64Bit.length === 0
    ? 'pass'
    : 'fail';

  const summary =
    status === 'pass'
      ? `16KB page-size: supported. zipalign OK, 64-bit ELF LOAD align OK.`
      : status === 'fail'
      ? `16KB page-size: unsupported. ${[
          zipalign.ok ? 'zipalign OK' : 'zipalign failed',
          failed64Bit.length
            ? `${failed64Bit.length} 64-bit .so failed (${summarizeFailures(
                failed64Bit,
              )})`
            : '',
        ]
          .filter(Boolean)
          .join(', ')}.`
      : `16KB page-size: unknown. ${error}`;

  const notificationText =
    status === 'pass'
      ? `16KB page-size: ✅ supported`
      : status === 'fail'
      ? `16KB page-size: ⚠️ unsupported - ${
          failed64Bit.length
            ? summarizeFailures(failed64Bit)
            : 'zipalign failed'
        }`
      : `16KB page-size: ⚠️ check failed - ${error}`;

  return {
    schemaVersion: 1,
    status,
    mode,
    apk: apkPath,
    generatedAt: new Date().toISOString(),
    summary,
    notificationText,
    tools,
    zipalign,
    elf: {
      checkedSoCount: elfRows.length,
      checked64BitSoCount: elfRows.filter(item => item.is64Bit).length,
      failed64Bit,
      failed32Bit,
      rows: elfRows,
    },
  };
}

function writeOutput(filePath, content) {
  if (!filePath) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const apkPath = path.resolve(args.apk || '');
  const mode =
    args.mode || process.env.RABBY_MOBILE_ANDROID_16KB_CHECK || 'warn';

  if (!apkPath || !pathExists(apkPath)) {
    throw new Error(`APK not found: ${args.apk || '<empty>'}`);
  }

  const sdkRoots = unique([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
  ]).filter(pathExists);

  const tools = {
    zipalign: findLatestZipalign(sdkRoots),
    llvmObjdump: findLatestLlvmObjdump(sdkRoots),
  };

  let report;
  try {
    if (!tools.zipalign) {
      throw new Error('zipalign not found in Android SDK build-tools');
    }
    if (!tools.llvmObjdump) {
      throw new Error('llvm-objdump not found in Android NDK');
    }

    const zipalign = runZipalign(tools.zipalign, apkPath);
    const elfRows = inspectSharedObjects({
      apkPath,
      llvmObjdumpPath: tools.llvmObjdump,
    });
    report = makeReport({
      apkPath,
      zipalign,
      elfRows,
      tools,
      mode,
    });
  } catch (error) {
    report = makeReport({
      apkPath,
      zipalign: { ok: false, outputTail: '' },
      elfRows: [],
      tools,
      mode,
      error: error && error.message ? error.message : String(error),
    });
  }

  writeOutput(args.json, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(args.text, `${report.notificationText}\n${report.summary}\n`);

  console.log(report.summary);
  if (report.elf.failed32Bit.length) {
    console.log(
      `16KB page-size: ${report.elf.failed32Bit.length} non-blocking 32-bit .so entries still have 4KB LOAD alignment.`,
    );
  }

  if (mode === 'strict' && report.status !== 'pass') {
    process.exitCode = 1;
  }
}

main();
