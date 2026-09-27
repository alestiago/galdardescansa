#!/usr/bin/env bash
set -euo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_directory="$(cd -- "${script_directory}/.." && pwd)"

cd "${project_directory}"

if ! command -v netlify &> /dev/null; then
  echo "Netlify CLI not found. Install with: npm install -g netlify-cli"
  exit 1
fi

if [[ ! -f ".netlify/state.json" && -z "${NETLIFY_SITE_ID:-}" ]]; then
  echo "This directory is not linked to a Netlify project."
  echo "Run 'netlify login' and then 'netlify link --name gleaming-otter-0c261f'."
  exit 1
fi

netlify deploy --prod --context production
