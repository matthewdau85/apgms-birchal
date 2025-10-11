#!/bin/sh
# shellcheck disable=SC3046
if [ -z "$husky_skip_init" ]; then
  husky_skip_init=1
  export husky_skip_init
fi
