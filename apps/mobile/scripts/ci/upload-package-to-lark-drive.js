#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { uploadFileToLarkDrive } = require('../libs/lark');

async function main() {
  const filePath = process.argv[2];
  const fileName = process.argv[3] || (filePath && path.basename(filePath));
  if (!filePath || !fileName) {
    throw new Error(
      'usage: upload-package-to-lark-drive.js <package-path> [drive-file-name]',
    );
  }

  const resolvedFilePath = path.resolve(filePath);
  if (!fs.existsSync(resolvedFilePath)) {
    throw new Error(`package file does not exist: ${resolvedFilePath}`);
  }

  const stat = fs.statSync(resolvedFilePath);
  console.error(
    `[lark-drive] uploading ${path.basename(fileName)} (${stat.size} bytes)`,
  );

  const result = await uploadFileToLarkDrive(resolvedFilePath, {
    fileName,
    onProgress: ({ blockNumber, blockCount }) => {
      console.error(`[lark-drive] uploaded block ${blockNumber}/${blockCount}`);
    },
  });

  console.error(
    `[lark-drive] upload succeeded: ${result.blockCount} blocks, ${result.size} bytes`,
  );
  process.stdout.write(result.url);
}

main().catch(error => {
  console.error(`[lark-drive] ${error.message}`);
  process.exitCode = 1;
});
