#!/bin/sh
# Copies just the app's web files into www/. Used by Netlify (publishes www/) and by the phone app build (Capacitor reads www/).
set -e
rm -rf www && mkdir -p www
cp index.html manifest.webmanifest sw.js www/
cp -R css js lib fonts icons guides www/
