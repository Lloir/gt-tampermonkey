# Galactic Tycoons – Sleek UI

A Tampermonkey userscript that gives [Galactic Tycoons](https://g2.galactictycoons.com) a sidebar layout, an EVE-style market, themes (including fully custom ones), chat tools (translation, blocklist) and responsive layouts for every screen size.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge).
2. Click **[gt-ui.user.js](https://raw.githubusercontent.com/Lloir/gt-tampermonkey/main/gt-ui.user.js)** — Tampermonkey will offer to install it.
3. Reload Galactic Tycoons.

Updates are automatic: Tampermonkey checks this repository and installs new versions when the `@version` number goes up (Tampermonkey → Settings → "Script Update" controls how often).

If you previously pasted the script in by hand, delete that old copy first so two copies don't run side by side.

## Notes

- Chat translation is off by default. When enabled it sends message text to Google Translate (Chrome 138+ uses on-device translation where available).
- All settings are stored in your browser only.
