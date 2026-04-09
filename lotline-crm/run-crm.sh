#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd "/Users/naamantrotter/Land Acquisition/lotline-crm"
exec npm run dev
