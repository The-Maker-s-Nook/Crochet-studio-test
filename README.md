# Crochet Studio (test version)

"Crochet Studio" is a working name (final name: The Makers Nook). This is the installable web app (PWA)
that testers use at https://crochetstudiotest.netlify.app

## What's here
- `index.html` – the page shell: header, bottom menu, and the list of code files to load (in order)
- `css/styles.css` – the app's look
- `js/` – the app's code, one file per area (they load in this order):
  - `core.js` – saved-data format, app state, small helpers, saving, icons, app constants (version, pattern limit, feedback email)
  - `money.js` – all money maths: labour, suggested prices, tax, rounding, material unit cost, sale totals, discounts
  - `ui.js` – shared screen pieces: pop-ups, notices, search boxes, photos, help buttons
  - `nav.js` – moving between screens, bottom menu, back button, drawing the current screen
  - `storage.js` – saving on the phone, pattern file storage, backups and restore
  - `home.js`, `products.js`, `materials.js`, `patterns.js`, `markets.js`, `checkout.js`, `reports.js`, `settings.js`, `import.js` – one file per area of the app
  - `sync.js` – accounts and cloud sync (Supabase); `account-screens.js` – sign-in and Account screens
  - `start.js` – starts the app: global listeners, loading data, offline support
- `sw.js` – lets the app work offline; bump the version number in it with every update, and list any new file
- `manifest.webmanifest`, `icons/`, `fonts/` – install icon, name and fonts
- `lib/` – PDF viewer (pdf.js)
- `guides/` – What's new and Tester guide PDFs shown inside the app
- `HOW-TO-INSTALL.txt` – notes for the app owner
- `netlify.toml` – tells Netlify to publish this folder as is (no build step)

## Updating
Every change saved to the `main` branch goes live automatically on Netlify (about 15 Netlify
credits per deploy), so only finished, tested versions are saved to `main`. Work in progress
lives on other branches, which Netlify does not deploy.

Current version: 24
