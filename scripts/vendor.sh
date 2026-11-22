#!/usr/bin/env bash
# Baut die mitgelieferten Bibliotheken unter custom_components/vorratskeller/frontend/vendor neu.
# Versionen fest; nach einem Update LICENSES.md und die Tests im Browser prüfen.
set -euo pipefail
ZIEL="$(cd "$(dirname "$0")/.." && pwd)/custom_components/vorratskeller/frontend/vendor"
ARBEIT="$(mktemp -d)"
trap 'rm -rf "$ARBEIT"' EXIT
cd "$ARBEIT"
npm init -y >/dev/null
npm install --ignore-scripts --no-audit --no-fund \
  barcode-detector@3.2.4 qrcode-generator@1.4.4 esbuild@0.25.10 >/dev/null
printf 'import qrcode from "qrcode-generator";\nexport default qrcode;\n' > qr-entry.js
./node_modules/.bin/esbuild node_modules/barcode-detector/dist/es/ponyfill.js --bundle --format=esm \
  --minify --legal-comments=eof --outfile="$ZIEL/barcode-detector.js"
./node_modules/.bin/esbuild qr-entry.js --bundle --format=esm --minify --legal-comments=eof \
  --outfile="$ZIEL/qrcode.js"
cp node_modules/zxing-wasm/dist/reader/zxing_reader.wasm "$ZIEL/"
shasum -a 256 "$ZIEL"/*
