#!/usr/bin/env bash
set -e

if ! command -v netlify &> /dev/null; then
  echo "Netlify CLI not found. Install with: npm install -g netlify-cli"
  exit 1
fi

netlify deploy --prod