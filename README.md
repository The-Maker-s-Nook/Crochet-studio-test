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
  - `photos.js` – product, material, pattern-link and receipt photos (and receipt PDFs), kept as separate files (see "How data is stored")
  - `xlsx.js` – makes zip folders and Excel workbooks with no extra libraries (used by report downloads and year-end receipts)
  - `home.js`, `products.js`, `materials.js`, `patterns.js`, `markets.js`, `reminders.js`, `checkout.js`, `settings.js`, `import.js` – one file per area of the app
  - `stock.js` – material stock settings (Pricing only / manual / automatic), per-material overrides, the −1/+1 package buttons, "What do you buy it in?" words, taking materials out when products are made
  - `expenses.js` – expense and receipt categories and how each counts in profit and tax, the market Costs box
  - `receipts.js` – Receipts list, add/edit form, details, Home "Snap receipt" button and card
  - `yearend.js` – year-end receipts: reminders, the zip folder of last year's photos, clearing photos
  - `reports.js` – Reports screen (Overview, Markets, Stock, Expenses & tax tabs); `report-files.js` – the PDF and Excel downloads
  - `sync.js` – accounts and cloud sync (Supabase); `account-screens.js` – sign-in and Account screens
  - `start.js` – starts the app: global listeners, loading data, offline support
- `sw.js` – lets the app work offline; bump the version number in it with every update, and list any new file
- `manifest.webmanifest`, `icons/`, `fonts/` – install icon, name and fonts
- `lib/` – PDF viewer (pdf.js)
- `guides/` – What's new and Tester guide PDFs shown inside the app
- `HOW-TO-INSTALL.txt` – notes for the app owner
- `netlify.toml` – tells Netlify to publish this folder as is (no build step)

## How data is stored
- **App data** (products, materials, markets, sales, settings...): one object, `data`, saved on the phone in
  IndexedDB (`crochetStudioPDFs` › `app` › `data`) and, with an account, as one row per user in Supabase
  (`app_data`, protected so each user only reaches their own row).
- **Pattern files**: IndexedDB store `pdfs`; with an account, Supabase Storage `user-files/<user id>/patterns/`.
- **Photos**: IndexedDB store `photos`; with an account, Supabase Storage `user-files/<user id>/photos/`.
  The app data only holds a short reference (`ph:<photo id>`), so saving and syncing stay small and fast.
  Older data held photos as `data:image/...` text; `photos.js` moves those out automatically.
- **Receipts** are expenses in `data.expenses` (store, date, category, before tax, tax, total, paid with, market, notes).
  Their photo or PDF is kept like any other photo (a `ph:` reference). After the year-end save and clear, the photo is
  removed and the receipt gets `photoOff: true`. Yarn, Supplies and Booth fees receipts are proof only (not taken off profit again).
- **Material stock**: `data.settings.materialStock` is `pricing`, `manual` or `auto`; a material can override it with
  `stockOverride: { on, mode }`. `stock` is the amount left in the material's unit; blank (`null`) means not counted yet.
  Each material category has a `packWord` (skein, bag, pack...).
- **Backups** (Settings › Backup): one JSON file with the data, the photos and the pattern files.
- Small per-device settings (open pattern, reading spot, folded panels) use `localStorage` (keys start with `cs`).

## Phone apps
The Android and iPhone app wrapper (Capacitor) lives on the `app-wrap` branch until the store launch:
`capacitor.config.json`, `package.json`, `js/native.js` (phone-app-only adjustments) and the GitHub build in
`.github/workflows/android.yml`. Every app change is made here first, then merged into `app-wrap`.

### Stripe Tap to Pay (test, `app-wrap` only)
- `js/stripe-pay.js` – adds Settings › Finances › Payments › "Take card payments with: None / Square / Stripe"; with Stripe,
  checkout's Card button becomes "Charge $X with Tap to Pay" (Stripe Terminal plugin `@capacitor-community/stripe-terminal`).
  Sales save with `payment: { method: 'card', via: 'stripe', stripePi, appFee, cardBrand, cardLast4, test }`.
  It does nothing on the website (no plugin there).
- `supabase/functions/stripe/` – the server part (Supabase Edge Function). Holds the Stripe secret key, creates each seller's
  own Stripe account (seller pays Stripe's fees, Stripe covers losses), connection tokens, payments with the app fee
  (1% on the free plan, 0% on paid; decided on the server), and confirms each payment with Stripe before the sale is saved.
  The seller's Stripe account id and selling-address location are kept in the user's `app_metadata` (users can't change it).
- `.github/workflows/stripe-server.yml` installs the function. Needs repository secrets `SUPABASE_ACCESS_TOKEN` and
  `STRIPE_SECRET_KEY` (sandbox `sk_test_...` only while testing). Never put either key in the code.
- Android builds need Android 11+ (minSdk 30) for Tap to Pay.

## Updating
Every change saved to the `main` branch goes live automatically on Netlify (about 15 Netlify
credits per deploy), so only finished, tested versions are saved to `main`. Work in progress
lives on other branches, which Netlify does not deploy.

Current version: 24
