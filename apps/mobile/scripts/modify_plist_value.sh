#!/bin/bash

PLIST_FILE="$1"
KEY="$2"
VALUE="$3"

FILE_TYPE=$(file "$PLIST_FILE")

CONVERT_BACK=false

if echo "$FILE_TYPE" | grep -q "Apple binary property list"; then
    plutil -convert xml1 "$PLIST_FILE"
    CONVERT_BACK=true
fi

plutil -replace "$KEY" -string "$VALUE" "$PLIST_FILE"

if [ "$CONVERT_BACK" = true ]; then
    plutil -convert binary1 "$PLIST_FILE"
fi

echo "Modified '$KEY' to '$VALUE' in $PLIST_FILE"
