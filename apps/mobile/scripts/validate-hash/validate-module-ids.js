const fs = require('fs');
const path = require('path');

function analyzeModuleIds(logFilePath) {
  console.log(`开始分析日志文件: ${logFilePath}\n`);

  if (!fs.existsSync(logFilePath)) {
    console.error(`错误: 日志文件 "${logFilePath}" 不存在`);
    return;
  }

  const fileContent = fs.readFileSync(logFilePath, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== ''); // 按行分割并移除空行

  if (lines.length === 0) {
    console.log('日志文件为空或不包含有效数据');
    return;
  }

  // 用于存储路径到 ID 的映射: Map<string_path, number_id>
  const pathToIdMap = new Map();
  // 用于存储 ID 到路径列表的映射: Map<number_id, string_path[]>
  const idToPathsMap = new Map();

  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;
    const parts = line.split('\t');
    if (parts.length !== 2) {
      console.warn(`警告: 第 ${lineNumber} 行格式不正确，已跳过: "${line}"`);
      continue;
    }

    const modulePath = parts[0].trim();
    const moduleIdStr = parts[1].trim();
    const moduleId = parseInt(moduleIdStr, 10);

    if (isNaN(moduleId)) {
      console.warn(
        `警告: 第 ${lineNumber} 行的模块 ID 不是有效数字，已跳过: "${line}"`,
      );
      continue;
    }

    // 检查: 相同路径是否生成了不同的 ID (这不应该在你的哈希逻辑中发生)
    if (
      pathToIdMap.has(modulePath) &&
      pathToIdMap.get(modulePath) !== moduleId
    ) {
      console.error(
        `严重错误: 路径 "${modulePath}" 之前生成的 ID 是 ${pathToIdMap.get(
          modulePath,
        )}, 现在是 ${moduleId} (在第 ${lineNumber} 行).`,
      );
    }
    pathToIdMap.set(modulePath, moduleId);

    // 收集 ID 到路径的映射
    if (!idToPathsMap.has(moduleId)) {
      idToPathsMap.set(moduleId, []);
    }
    // 只有当这个路径还没被记录到这个ID下时才添加（避免同一行重复处理，虽然不太可能）
    if (!idToPathsMap.get(moduleId).includes(modulePath)) {
      idToPathsMap.get(moduleId).push(modulePath);
    }
  }

  console.log(`总共处理了 ${lineNumber} 行有效日志\n`);

  // --- 分析结果 ---

  // 1. 检查不同路径生成相同 ID (哈希碰撞)
  let collisionsFound = 0;
  console.log('检查不同路径生成相同 ID (哈希碰撞):');
  idToPathsMap.forEach((paths, id) => {
    if (paths.length > 1) {
      collisionsFound++;
      console.log(`  ID: ${id} 被以下不同路径共享 (碰撞):`);
      paths.forEach(p => {
        console.log(`    - ${p}`);
      });
    }
  });

  if (collisionsFound === 0) {
    console.log('未发现不同路径生成相同 ID 的情况\n');
    process.exit(0);
  } else {
    console.log(`总共发现 ${collisionsFound} 组哈希碰撞\n`);
    process.exit(1);
  }
}

// --- 执行分析 ---
// 如果你希望从命令行参数接收日志文件路径：
const customLogPath = process.argv[2];
analyzeModuleIds(customLogPath);
