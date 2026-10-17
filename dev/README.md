# Developer tools (not part of the live app)

This branch is never deployed. It keeps the build and test tools used up to version 23.

- `build/` – how index.html was assembled: `index-v15.html` is the original app, `splice.py` adds the
  feature files (cloud.js, sales.js, quick.js, tabsync.js, import.js, v22.js, v23.js, pdfw.js and their .css).
  The finished app is `index.html` on the `main` branch; from version 24 on, it can be edited directly there.
- `tests/` – Playwright browser tests (Python). They expect the app served at http://localhost:8774
  (`python3 -m http.server 8774` in the app folder). Paths inside some tests point to the old workspace and
  may need updating. `sample-pricing-spreadsheet.xlsx` is the spreadsheet used to test the import.
