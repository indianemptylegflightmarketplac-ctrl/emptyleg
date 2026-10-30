#!/bin/bash
# Simple CI watch script — run with PR number argument
# Example: bash watch-ci.sh 40653175669
if [ -z "$1" ]; then
  echo "Usage: bash watch-ci.sh <run-id>"
  echo "Note: This requires authenticated GitHub CLI or API access"
  exit 1
fi
RUN_ID=$1
echo "Checking CI run $RUN_ID..."
echo "Run link: https://github.com/indianemptylegflightmarketplac-ctrl/emptyleg/actions/runs/$RUN_ID"
echo "Status: Check manually at Actions tab (automated polling requires GH_TOKEN)"
