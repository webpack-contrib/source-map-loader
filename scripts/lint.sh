#!/usr/bin/env sh

`npm bin`/eslint --ext .js .

if [ $? = 0 ]; then
  echo "No errors."
else
  exit 1
fi
