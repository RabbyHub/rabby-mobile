#!/usr/bin/env node
/**
 * Migration script to move Text, TextInput imports from:
 * - 'react-native'
 * - 'react-native-gesture-handler'
 * - 'react-native-animateable-text'
 *
 * To '@/components/Typography'
 *
 * This script uses a regex-based approach to preserve formatting.
 *
 * Usage:
 *   node migrate-text-imports.js [--dry-run] [--verbose]
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = path.resolve(__dirname, '../src');
const TARGET_IMPORT_PATH = '@/components/Typography';

// Mapping of source modules to their Typography exports
const IMPORT_MAPPING = {
  'react-native': {
    Text: 'Text',
    TextInput: 'TextInput',
  },
  'react-native-gesture-handler': {
    Text: 'RNGHText',
    TextInput: 'RNGHTextInput',
  },
  'react-native-animateable-text': {
    default: 'AnimateableText',
  },
};

// Track changes for reporting
const changes = [];
const errors = [];

/**
 * Find all .ts and .tsx files recursively
 */
function findFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and other common exclusions
      if (item === 'node_modules' || item === 'dist' || item === '.git') {
        continue;
      }
      findFiles(fullPath, files);
    } else if (
      stat.isFile() &&
      (item.endsWith('.ts') || item.endsWith('.tsx'))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Parse import statements from a file
 * Returns array of { source, specifiers: [{ imported, local }], startIndex, endIndex, fullMatch }
 */
function parseImports(content) {
  const imports = [];

  // Match import statements - handles both:
  // import { Text, View } from 'react-native'
  // import AnimateableText from 'react-native-animateable-text'
  const importRegex =
    /import\s+(?:(\{[^}]*\})|(\*\s+as\s+\w+)|(\w+))\s+from\s+['"]([^'"]+)['"];?/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const [fullMatch, namedImports, namespaceImport, defaultImport, source] =
      match;

    const specifiers = [];

    if (namedImports) {
      // Parse named imports: { Text, TextInput as TI, View }
      const namedRegex = /(\w+)(?:\s+as\s+(\w+))?/g;
      let namedMatch;
      while ((namedMatch = namedRegex.exec(namedImports)) !== null) {
        const [, imported, local] = namedMatch;
        if (imported) {
          specifiers.push({
            imported,
            local: local || imported,
          });
        }
      }
    } else if (defaultImport) {
      specifiers.push({
        imported: 'default',
        local: defaultImport,
      });
    } else if (namespaceImport) {
      specifiers.push({
        imported: 'namespace',
        local: namespaceImport.replace('* as ', ''),
      });
    }

    imports.push({
      source,
      specifiers,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
      fullMatch,
    });
  }

  return imports;
}

/**
 * Process a single file
 */
function processFile(filePath, options = {}) {
  const { dryRun = false, verbose = false } = options;

  // Skip the Typography.tsx file itself
  if (filePath.includes('Typography.tsx')) {
    return { changed: false, reason: 'skipped (Typography.tsx itself)' };
  }

  // Also skip the old components/Text.tsx if it exists
  if (filePath.endsWith('/components/Text.tsx')) {
    return { changed: false, reason: 'skipped (legacy Text.tsx)' };
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    errors.push({ file: filePath, error: error.message });
    return { changed: false, reason: 'read error' };
  }

  const imports = parseImports(content);

  // Find imports that need migration
  const importsToMigrate = [];
  const existingTypographyImport = imports.find(
    imp => imp.source === TARGET_IMPORT_PATH,
  );

  for (const imp of imports) {
    if (IMPORT_MAPPING[imp.source]) {
      const mapping = IMPORT_MAPPING[imp.source];
      const itemsToMigrate = [];
      const itemsToKeep = [];

      for (const spec of imp.specifiers) {
        if (spec.imported === 'namespace') {
          // Keep namespace imports as-is
          itemsToKeep.push(spec);
        } else if (mapping[spec.imported]) {
          itemsToMigrate.push({
            ...spec,
            typographyName: mapping[spec.imported],
            source: imp.source,
          });
        } else {
          itemsToKeep.push(spec);
        }
      }

      if (itemsToMigrate.length > 0) {
        importsToMigrate.push({
          importDecl: imp,
          itemsToMigrate,
          itemsToKeep,
          hasRemainingImports: itemsToKeep.length > 0,
        });
      }
    }
  }

  if (importsToMigrate.length === 0) {
    return { changed: false, reason: 'no changes needed' };
  }

  // Build the change summary
  const changeSummary = {
    file: filePath,
    migrations: importsToMigrate
      .map(group =>
        group.itemsToMigrate.map(item => ({
          from: `${item.source}.${item.imported}`,
          to: `${TARGET_IMPORT_PATH}.${item.typographyName}`,
          local: item.local,
        })),
      )
      .flat(),
  };

  if (dryRun) {
    changes.push(changeSummary);
    return { changed: true, reason: 'would change (dry-run)' };
  }

  // Collect all new Typography imports
  const newTypographyImports = new Map(); // localName -> typographyExportName

  // Add existing Typography imports
  if (existingTypographyImport) {
    for (const spec of existingTypographyImport.specifiers) {
      if (spec.imported !== 'default' && spec.imported !== 'namespace') {
        newTypographyImports.set(spec.local, spec.imported);
      }
    }
  }

  // Add new imports to migrate
  for (const group of importsToMigrate) {
    for (const item of group.itemsToMigrate) {
      newTypographyImports.set(item.local, item.typographyName);
    }
  }

  // Build new import statements
  const newTypographyImportStr = `import { ${Array.from(
    newTypographyImports.entries(),
  )
    .map(([local, imported]) =>
      local === imported ? imported : `${imported} as ${local}`,
    )
    .join(', ')} } from '${TARGET_IMPORT_PATH}';`;

  // Build modified original imports
  const modifiedImports = [];
  for (const group of importsToMigrate) {
    if (group.hasRemainingImports) {
      // Keep the import but remove migrated specifiers
      const remainingSpecs = group.itemsToKeep
        .map(spec => {
          if (spec.imported === 'namespace') {
            return `* as ${spec.local}`;
          }
          return spec.imported === spec.local
            ? spec.imported
            : `${spec.imported} as ${spec.local}`;
        })
        .join(', ');
      const newImportStr = `import { ${remainingSpecs} } from '${group.importDecl.source}';`;
      modifiedImports.push({
        original: group.importDecl.fullMatch,
        replacement: newImportStr,
      });
    } else {
      // Remove the entire import
      modifiedImports.push({
        original: group.importDecl.fullMatch,
        replacement: '',
      });
    }
  }

  // Apply changes to content
  let newContent = content;

  // Remove or modify old imports (process in reverse order to preserve indices)
  const sortedImports = importsToMigrate
    .map(g => g.importDecl)
    .sort((a, b) => b.startIndex - a.startIndex);

  for (const imp of sortedImports) {
    const group = importsToMigrate.find(g => g.importDecl === imp);
    if (group.hasRemainingImports) {
      const remainingSpecs = group.itemsToKeep
        .map(spec => {
          if (spec.imported === 'namespace') {
            return `* as ${spec.local}`;
          }
          return spec.imported === spec.local
            ? spec.imported
            : `${spec.imported} as ${spec.local}`;
        })
        .join(', ');
      const newImportStr = `import { ${remainingSpecs} } from '${imp.source}';`;
      newContent =
        newContent.slice(0, imp.startIndex) +
        newImportStr +
        newContent.slice(imp.endIndex);
    } else {
      // Remove the entire import and any following newline
      let endIdx = imp.endIndex;
      if (newContent.slice(endIdx).startsWith('\n')) {
        endIdx++;
      }
      newContent =
        newContent.slice(0, imp.startIndex) + newContent.slice(endIdx);
    }
  }

  // Add Typography import
  if (existingTypographyImport) {
    // Replace existing Typography import
    newContent =
      newContent.slice(0, existingTypographyImport.startIndex) +
      newTypographyImportStr +
      newContent.slice(existingTypographyImport.endIndex);
  } else {
    // Find the best place to insert - after the last import
    const allImports = parseImports(newContent);
    if (allImports.length > 0) {
      const lastImport = allImports[allImports.length - 1];
      newContent =
        newContent.slice(0, lastImport.endIndex) +
        '\n' +
        newTypographyImportStr +
        newContent.slice(lastImport.endIndex);
    } else {
      // No imports, add at the beginning
      newContent = newTypographyImportStr + '\n' + newContent;
    }
  }

  // Clean up multiple consecutive newlines
  newContent = newContent.replace(/\n{3,}/g, '\n\n');

  // Write the file
  fs.writeFileSync(filePath, newContent, 'utf-8');

  changes.push(changeSummary);

  if (verbose) {
    console.log(`✓ Migrated: ${path.relative(SRC_DIR, filePath)}`);
  }

  return { changed: true, reason: 'migrated' };
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  console.log(
    `\n${dryRun ? '[DRY RUN] ' : ''}Migrating Text/TextInput imports...\n`,
  );

  // Find all TypeScript files
  const files = findFiles(SRC_DIR);
  console.log(`Found ${files.length} TypeScript files to scan\n`);

  let changedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    try {
      const result = processFile(file, { dryRun, verbose });
      if (result.changed) {
        changedCount++;
      }
    } catch (error) {
      errorCount++;
      errors.push({ file, error: error.message });
      console.error(
        `✗ Error processing ${path.relative(SRC_DIR, file)}: ${error.message}`,
      );
    }
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total files scanned: ${files.length}`);
  console.log(
    `Files ${dryRun ? 'that would be' : ''} changed: ${changedCount}`,
  );

  if (errors.length > 0) {
    console.log(`\nErrors: ${errors.length}`);
    for (const err of errors) {
      console.log(`  - ${path.relative(SRC_DIR, err.file)}: ${err.error}`);
    }
  }

  if (changes.length > 0) {
    console.log(`\n${dryRun ? 'Planned ' : ''}Changes:`);
    for (const change of changes) {
      const relativePath = path.relative(SRC_DIR, change.file);
      console.log(`\n  ${relativePath}:`);
      for (const migration of change.migrations) {
        const aliasInfo =
          migration.local !== migration.to.split('.').pop()
            ? ` (as ${migration.local})`
            : '';
        console.log(`    - ${migration.from} → ${migration.to}${aliasInfo}`);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}\n`);

  // Exit with error code if there were errors
  process.exit(errorCount > 0 ? 1 : 0);
}

main();
