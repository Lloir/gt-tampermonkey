# Galactic Tycoons – Sleek UI

A Tampermonkey userscript that gives [Galactic Tycoons](https://g2.galactictycoons.com) a sidebar layout, an EVE-style market, themes (including fully custom ones), chat tools (translation, blocklist) and responsive layouts for every screen size.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge).
2. Click **[gt-ui.user.js](https://raw.githubusercontent.com/Lloir/gt-tampermonkey/main/gt-ui.user.js)** — Tampermonkey will offer to install it.
3. Reload Galactic Tycoons.

Updates are automatic: Tampermonkey checks this repository and installs new versions when the `@version` number goes up (Tampermonkey → Settings → "Script Update" controls how often).

If you previously pasted the script in by hand, delete that old copy first so two copies don't run side by side.

### Optional Pasteimg previews

Install **[gt-pasteimg.user.js](https://raw.githubusercontent.com/Lloir/gt-tampermonkey/main/gt-pasteimg.user.js)** in Tampermonkey alongside Sleek UI to show Pasteimg image-page links inline in Comms, including multi-chat. The original message stays visible, and clicking a preview opens its Pasteimg page. Tampermonkey will request permission to read `pasteimg.com` pages so the script can find each image URL. No change to `gt-ui.user.js` is required. Previews load automatically for any Pasteimg link posted in chat, so Pasteimg can see your IP address and you will see whatever image is linked; skip this script if you don't want that.

- **Base page extras** (collapsible Bases/Fleet lists, Restock times, chat and Exchange panels under the bases) are all off by default; tick them under Settings → Base page.

## Notes

- Chat translation is off by default. When enabled it sends message text to Google Translate (Chrome 138+ uses on-device translation where available).
- All settings are stored in your browser only.
- Sleek UI's **Settings → Background image** accepts a PNG, JPEG, or WebP file up to 10 MB. It is stored in this browser and can be removed from the same setting; settings exports do not include the image.
