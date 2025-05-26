#!/bin/bash

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
SUMMARY_DIFFERENCES_FILE="manual_object_file_differences_summary.txt"
DETAILED_DIFFS_DIR="detailed_o_diffs"

# 清理旧的报告文件和目录
> "${SUMMARY_DIFFERENCES_FILE}"
rm -rf "${DETAILED_DIFFS_DIR}"
mkdir -p "${DETAILED_DIFFS_DIR}"

echo "Starting comparison..."

# 递归查找 BUILD_1_INTERMEDIATES_DIR 中的所有 .o 文件
find "${BUILD_1_INTERMEDIATES_DIR}" -type f -name "*.o" -print0 | while IFS= read -r -d $'\0' file1_o; do
  relative_path_o="${file1_o#${BUILD_1_INTERMEDIATES_DIR}/}"
  file2_o="${BUILD_2_INTERMEDIATES_DIR}/${relative_path_o}"

  # 替换路径中的 / 为 _，用于后续文件名
  sanitized_relative_path_o=$(echo "${relative_path_o}" | tr '/' '_')

  # 打印当前正在比较的文件，避免长时间无输出
  echo -n "Comparing: ${relative_path_o} ... "

  if [ -f "${file2_o}" ]; then
    cmp -s "${file1_o}" "${file2_o}"
    cmp_exit_code=$?

    if [ ${cmp_exit_code} -ne 0 ]; then
      echo "DIFFERENT (binary)" | tee -a "${SUMMARY_DIFFERENCES_FILE}"
      echo "File: ${relative_path_o}" >> "${SUMMARY_DIFFERENCES_FILE}"
      DIFFERENCES_FOUND=true

      # 进行 otool 反汇编 diff
      otool_diff_output_file="${DETAILED_DIFFS_DIR}/${sanitized_relative_path_o}.asm.diff"
      echo "  -> Performing otool disassembly diff..."
      # 将 stderr 重定向到 stdout 以捕获 otool 可能的错误
      diff_result=$(diff -u <(otool -tV "${file1_o}" 2>&1) <(otool -tV "${file2_o}" 2>&1))

      if [ -n "$diff_result" ]; then
          echo "${diff_result}" > "${otool_diff_output_file}"
          echo "     OTool Disassembly DIFFERENCE details saved to ${otool_diff_output_file}" >> "${SUMMARY_DIFFERENCES_FILE}"
      else
          echo "     OTool Disassembly shows NO textual difference (despite binary difference)." >> "${SUMMARY_DIFFERENCES_FILE}"
          # 保存原始 otool 输出
          otool_build1_raw_output="${DETAILED_DIFFS_DIR}/${sanitized_relative_path_o}_build1.asm.txt"
          otool_build2_raw_output="${DETAILED_DIFFS_DIR}/${sanitized_relative_path_o}_build2.asm.txt"
          otool -tV "${file1_o}" > "${otool_build1_raw_output}" 2>&1
          otool -tV "${file2_o}" > "${otool_build2_raw_output}" 2>&1
          echo "     Raw otool outputs saved for manual inspection." >> "${SUMMARY_DIFFERENCES_FILE}"

          # 进行 hexdump diff
          hex_diff_output_file="${DETAILED_DIFFS_DIR}/${sanitized_relative_path_o}.hex.diff"
          echo "  -> Performing hexdump diff..."
          cmpl_output_file="${DETAILED_DIFFS_DIR}/${sanitized_relative_path_o}.bytes.cmpl"
          cmp -l "${file1_o}" "${file2_o}" > "${cmpl_output_file}"
          if [ -s "${cmpl_output_file}" ]; then
            echo "     Byte-level DIFFERENCES (cmp -l) saved to ${cmpl_output_file}" >> "${SUMMARY_DIFFERENCES_FILE}"
          else
            echo "     cmp -l reported no byte differences, which is unusual if cmp -s reported a difference. Check file sizes or corruption." >> "${SUMMARY_DIFFERENCES_FILE}"
            diff -u <(hexdump -C "${file1_o}") <(hexdump -C "${file2_o}") > "${hex_diff_output_file}"
            echo "     Full hexdump diff (may be large) saved to ${hex_diff_output_file}" >> "${SUMMARY_DIFFERENCES_FILE}"
          fi
      fi
      echo "----------------------------------------" >> "${SUMMARY_DIFFERENCES_FILE}"
    else
      echo "Identical"
    fi
  else
    echo "MISSING in Build 2" | tee -a "${SUMMARY_DIFFERENCES_FILE}"
    echo "File: ${file2_o} (expected)" >> "${SUMMARY_DIFFERENCES_FILE}"
    echo "----------------------------------------" >> "${SUMMARY_DIFFERENCES_FILE}"
    DIFFERENCES_FOUND=true
  fi
done

echo "" #换行
echo "-----------------------------------------------------"
echo "Comparison finished."
if [ "$DIFFERENCES_FOUND" = true ]; then
  echo "Differences found in .o files."
  echo "Summary of differing/missing files: ${SUMMARY_DIFFERENCES_FILE}"
  echo "Detailed diffs (if any) are in directory: ./${DETAILED_DIFFS_DIR}/"
else
  echo "No differences found in .o files between the two provided intermediate directories."
fi
echo "-----------------------------------------------------"
