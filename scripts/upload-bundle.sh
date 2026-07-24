#!/bin/bash
#
# upload-bundle.sh — Quick OTA bundle upload for demos
#
# Usage:
#   ./scripts/upload-bundle.sh <bundle-zip-path> [bundleVersion] [description]
#
# Examples:
#   ./scripts/upload-bundle.sh ./bundles/bundle-ota.zip 7 "Fix splash screen animation"
#   ./scripts/upload-bundle.sh ./bundles/bundle-ota.zip
#
# Environment:
#   OTA_SERVER_URL - defaults to http://localhost:3000 (use your Vercel URL for production)
#

set -e

BUNDLE_PATH="${1}"
BUNDLE_VERSION="${2:-7}"
DESCRIPTION="${3:-Demo OTA update}"
OTA_SERVER_URL="${OTA_SERVER_URL:-http://localhost:3000}"

if [ -z "$BUNDLE_PATH" ]; then
  echo "❌ Usage: ./scripts/upload-bundle.sh <bundle-zip-path> [bundleVersion] [description]"
  echo ""
  echo "   Example: ./scripts/upload-bundle.sh ./bundles/bundle-ota.zip 7 'New feature'"
  exit 1
fi

if [ ! -f "$BUNDLE_PATH" ]; then
  echo "❌ File not found: $BUNDLE_PATH"
  exit 1
fi

echo "🚀 Uploading OTA bundle to $OTA_SERVER_URL/api/upload"
echo "   File: $BUNDLE_PATH"
echo "   Bundle Version: $BUNDLE_VERSION"
echo "   Description: $DESCRIPTION"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$OTA_SERVER_URL/api/upload" \
  -F "file=@${BUNDLE_PATH}" \
  -F "appId=investor-app-android" \
  -F "platform=android" \
  -F "jsVersion=1" \
  -F "bundleVersion=${BUNDLE_VERSION}" \
  -F "description=${DESCRIPTION}" \
  -F "appVersion=5.2" \
  -F "isMandatory=false" \
  -F "releaseState=20" \
  -F "rollout=100")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  echo "✅ Upload successful!"
  echo ""
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
  echo "❌ Upload failed (HTTP $HTTP_CODE)"
  echo ""
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  exit 1
fi
