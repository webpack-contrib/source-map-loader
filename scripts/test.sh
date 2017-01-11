#!/usr/bin/env sh

# exit the script as soon as one of the commands failed
set -e

# mocha configuration options
mocha_config="
  --compilers js:babel/register \
  --recursive \
  --reporter spec \
  --timeout 3000"

npm run lint

if [ "$CI" = true ]; then
  # create code coverage report when it runs on CI
  `npm bin`/babel-node `npm bin`/isparta cover \
    --report text \
    --report html \
    `npm bin`/_mocha -- $mocha_config
  # This outputs a nasty error message but it does not affect the end result.
  # The reason for the error is that when using babel-node return statements are only allowed within functions,
  # while in the mocha source code there is a return statement in the outermost scope.
else
  # add --debug and --watch to debug tests
  `npm bin`/mocha $mocha_config
fi
