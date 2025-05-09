# 替换为你的实际文件名
BINARY1_PATH="./build_20250509-131801/RabbyMobile" # 对应 ldr x8, [x8, #0x3c0]
BINARY2_PATH="./build_20250509-174856/RabbyMobile" # 对应 ldr x8, [x8, #0x3c8]

SEGMENT_NAME="__DATA_CONST"
SECTION_NAME="__got"

echo "Dumping $SEGMENT_NAME $SECTION_NAME for $BINARY1_PATH..."
otool -s "$SEGMENT_NAME" "$SECTION_NAME" "$BINARY1_PATH" > got_dump_build1.txt

echo "Dumping $SEGMENT_NAME $SECTION_NAME for $BINARY2_PATH..."
otool -s "$SEGMENT_NAME" "$SECTION_NAME" "$BINARY2_PATH" > got_dump_build2.txt

echo "Comparing dumped __got sections..."
diff_output=$(diff got_dump_build1.txt got_dump_build2.txt)

if [ -z "$diff_output" ]; then
    echo "__got sections are identical."
else
    echo "__got sections have differences:"
    echo "$diff_output"
    # 为了更精确定位，我们可以尝试直接在 diff 输出中查找与我们偏移相关的地址
fi
