#!/bin/bash
# Start the Splendor Online frontend (Next.js)
set -e
cd "$(dirname "$0")/frontend"
npm run dev
