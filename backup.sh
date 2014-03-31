
#!/bin/bash

sqlite3 $HOME/node/current.db <<< ".dump" | sqlite3 $HOME/static/db/`date +"%Y-%m-%d"`.sqlite
