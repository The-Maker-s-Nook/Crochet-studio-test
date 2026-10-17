# Crochet Studio (test version)

"Crochet Studio" is a working name. This is the installable web app (PWA) that testers use at
https://crochetstudiotest.netlify.app

## What's here
- `index.html` – the whole app (screens, logic and styles)
- `sw.js` – lets the app work offline; bump the version number in it with every update
- `manifest.webmanifest`, `icons/`, `fonts/` – install icon, name and fonts
- `lib/` – PDF viewer (pdf.js)
- `guides/` – What's new and Tester guide PDFs shown inside the app
- `HOW-TO-INSTALL.txt` – notes for the app owner
- `netlify.toml` – tells Netlify to publish this folder as is (no build step)

## Updating
Each version is saved here. When Netlify is linked to this repository, every change saved to
the `main` branch goes live automatically (about 15 Netlify credits per deploy), so only finished,
tested versions are saved to `main`.

Current version: 23
