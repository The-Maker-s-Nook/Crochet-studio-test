# Quick QA pass
Serve the app folder (python3 -m http.server 8765) and run:
  NODE_PATH=$(npm root -g) node tools/qa/run.js 8765
Needs Node and Playwright (Chromium). Prints PASS/FAIL per check.
