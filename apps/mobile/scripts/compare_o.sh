#!/bin/bash

# --- 配置 ---
# 无需配置，路径将从命令行参数获取

# --- 函数定义 ---
# (无复杂函数需要)

# --- 主逻辑 ---

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <path_to_intermediates_build1> <path_to_intermediates_build2>"
  echo "Example: $0 ./run1_intermediates_manual ./run2_intermediates_manual"
  exit 1
fi

BUILD_1_INTERMEDIATES_DIR="$1"
BUILD_2_INTERMEDIATES_DIR="$2"

if [ ! -d "${BUILD_1_INTERMEDIATES_DIR}" ]; then
  echo "Error: Directory for build 1 not found: ${BUILD_1_INTERMEDIATES_DIR}"
  exit 1
fi

if [ ! -d "${BUILD_2_INTERMEDIATES_DIR}" ]; then
  echo "Error: Directory for build 2 not found: ${BUILD_2_INTERMEDIATES_DIR}"
  exit 1
fi

echo "-----------------------------------------------------"
echo "Comparing .o files from:"
echo "Build 1: ${BUILD_1_INTERMEDIATES_DIR}"
echo "Build 2: ${BUILD_2_INTERMEDIATES_DIR}"
echo "-----------------------------------------------------"

DIFFERENCES_FOUND=false
DIFFERENCES_FILE="manual_object_file_differences.txt"
DETAILED_DIFFS_DIR="detailed_o_diffs" # 目录用于存放每个不同 .o 文件的详细 diff

> "${DIFFERENCES_FILE}" # 清空或创建差异记录文件
rm -rf "${DETAILED_DIFFS_DIR}" # 清理旧的详细 diff 目录
mkdir -p "${DETAILED_DIFFS_DIR}"

# 递归查找 BUILD_1_INTERMEDIATES_DIR 中的所有 .o 文件
find "${BUILD_1_INTERMEDIATES_DIR}" -type f -name "*.o" -print0 | while IFS= read -r -d $'\0' file1_o; do
  # 从 <path_to_intermediates_build1>/Path/To/File.o 得到 Path/To/File.o
  relative_path_o="${file1_o#${BUILD_1_INTERMEDIATES_DIR}/}"
  file2_o="${BUILD_2_INTERMEDIATES_DIR}/${relative_path_o}"

  if [ -f "${file2_o}" ]; then
    # echo "Comparing: ${relative_path_o}" # 可以取消注释以获得更详细的输出

    # 先用 cmp 快速判断二进制是否相同
    cmp -s "${file1_o}" "${file2_o}"
    if [ $? -ne 0 ]; then
      echo "DIFFERENCE (binary): ${relative_path_o}" | tee -a "${DIFFERENCES_FILE}"
      DIFFERENCES_FOUND=true

      # 如果二进制不同，再进行 otool diff 来查看汇编差异
      # 并将详细 diff 保存到单独的文件中
      sanitized_relative_path_o=$(echo "${relative_path_o}" | tr '/' '_') # 将路径中的 / 替换为 _，用于文件名
      diff_output_file="${DETAILED_DIFFS_DIR}/${sanitized_relative_path_o}.diff"

      echo "  -> Performing otool diff, output to: ${diff_output_file}"
      # diff -u <(otool -tV "${file1_o}") <(otool -tV "${file2_o}") > "${diff_output_file}" 2>&1
      # 使用 process substitution 来避免临时文件，并将 stderr 重定向到 stdout
      diff_result=$(diff -u <(otool -tV "${file1_o}" 2>&1) <(otool -tV "${file2_o}" 2>&1))

      if [ -n "$diff_result" ]; then
          echo "${diff_result}" > "${diff_output_file}"
          echo "     OTool Disassembly DIFFERENCE details saved to ${diff_output_file}" >> "${DIFFERENCES_FILE}"
      else
          # 这种情况理论上不应该发生，如果 cmp 说不同，otool diff 应该也显示不同
          # 除非 otool 本身在两次运行时有细微输出差异但不影响指令
          echo "     OTool Disassembly shows NO textual difference (despite binary difference). Check manually or otool error." >> "${DIFFERENCES_FILE}"
          # 尝试保存 otool 的原始输出以便调试
          otool -tV "${file1_o}" > "${DETAILED_DIFFS_DIR}/${sanitized_relative_path_o}_build1.txt" 2>&1
          otool -tV "${file2_o}" > "${DETAILED_DIFFS_DIR}/${sanitized_relative_path_o}_build2.txt" 2>&1
      fi
      echo "----------------------------------------" >> "${DIFFERENCES_FILE}"
    # else
      # echo "  Identical (binary): ${relative_path_o}" # 可以取消注释
    fi
  else
    echo "WARNING: Corresponding file not found in second build: ${file2_o}" | tee -a "${DIFFERENCES_FILE}"
    DIFFERENCES_FOUND=true # 认为文件缺失也是一种差异
  fi
done

echo "-----------------------------------------------------"
if [ "$DIFFERENCES_FOUND" = true ]; then
  echo "Differences found in .o files."
  echo "Summary of differing files (or missing files): ${DIFFERENCES_FILE}"
  echo "Detailed disassembly diffs (for files that differed): ./${DETAILED_DIFFS_DIR}/"
else
  echo "No differences found in .o files between the two provided intermediate directories."
fi
echo "-----------------------------------------------------"
