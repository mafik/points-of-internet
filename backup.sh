#!/bin/bash

CURRENT=$HOME/node/current.db
SNAPSHOT=$HOME/static/db/`date +"%Y-%m-%d"`.sqlite

sqlite3 $CURRENT <<< ".dump" | sqlite3 $SNAPSHOT
gzip $SNAPSHOT
