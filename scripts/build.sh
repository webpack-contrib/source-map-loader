#!/usr/bin/env sh

npm run clean
`npm bin`/babel src --out-dir lib --source-maps
