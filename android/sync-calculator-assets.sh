#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
assets_dir="$repo_dir/android/app/src/main/assets"

mkdir -p "$assets_dir/calculator"
rsync -a --delete "$repo_dir/calculator/" "$assets_dir/calculator/"
cp "$repo_dir/calculator-v42.html" "$assets_dir/index.html"
