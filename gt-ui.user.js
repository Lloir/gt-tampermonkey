// ==UserScript==
// @name         Galactic Tycoons – Sleek UI
// @namespace    https://github.com/Lloir/ef
// @version      0.9.33
// @description  Sidebar navigation, EVE-style market layout, command palette, responsive layout for Galactic Tycoons
// @match        https://galactictycoons.com/*
// @match        https://*.galactictycoons.com/*
// @exclude      https://api.*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Lloir/gt-tampermonkey/main/gt-ui.user.js
// @downloadURL  https://raw.githubusercontent.com/Lloir/gt-tampermonkey/main/gt-ui.user.js
// ==/UserScript==

/*
 * Design rules (the game is a Vue + Bootstrap 5 SPA):
 *  - CSS first. We restyle/relocate existing nodes instead of rebuilding them,
 *    so Vue's click handlers and re-renders keep working.
 *  - Everything keys off stable classes/data attributes seen in the DOM
 *    (nav.navbar, [data-nav], .card, .list-group, .com-group ...), never
 *    hashed asset names.
 *  - One small JS piece: the sidebar collapse toggle (persisted).
 *  - Screens are added one block at a time in the SCREENS section below.
 */
(function () {
  'use strict';

  const KEY = 'gtui:collapsed';
  const root = document.documentElement;

  const store = {
    get() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } },
    set(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* ignore */ } },
  };

  const CSS = `
  :root {
    --ui-bg: #07081a;
    --ui-panel: #0d0f26;
    --ui-panel-2: #131637;
    --ui-border: #25264d;
    --ui-fg: #d4d9ff;
    --ui-dim: #8c91b8;
    --ui-accent: #7c5cff;
    --ui-accent-rgb: 124, 92, 255;
    --ui-accent-fg: #fff;
    --ui-hi: #fff;
    --ui-panel-3: color-mix(in srgb, var(--ui-panel-2) 82%, #fff);
    --ui-rail-open: 208px;
    --ui-rail-closed: 56px;
    --ui-radius: 8px;
  }

  /* neutralise the old GT Companion page-invert / compact hacks if present */
  html.gtc-invert-page, html.gtc-invert-page body,
  html.gtc-invert-page img, html.gtc-invert-page canvas { filter: none !important; }

  html body { background: var(--ui-bg) !important; color: var(--ui-fg); }
  /* make the game's own Bootstrap text colours follow the theme (needed for light custom themes) */
  html body { --bs-body-color: var(--ui-fg); --bs-body-bg: var(--ui-bg); --bs-secondary-color: var(--ui-dim); --bs-tertiary-color: var(--ui-dim); --bs-emphasis-color: var(--ui-hi); --bs-border-color: var(--ui-border); --bs-heading-color: var(--ui-hi); --bs-link-color: var(--ui-accent); }
  html body .link-light, html body .text-light, html body .text-white, html body .text-body, html body .text-body-secondary, html body .text-body-tertiary { color: var(--ui-fg) !important; }
  html body .text-body-secondary, html body .text-body-tertiary { color: var(--ui-dim) !important; }

  /* ============ SHELL: nav becomes a left rail ============ */
  html body #app { height: 100vh; min-height: 0; }
  html body #app > main.container-xxl { margin-right: 0 !important; }   /* Bootstrap's auto right margin was eating the free space on the Comms page */
  html body #app > main { margin-left: var(--ui-rail-open) !important; width: auto !important; min-width: 0; transition: margin-left .15s ease; }
  html.gtui-collapsed body #app > main { margin-left: var(--ui-rail-closed) !important; }

  html body #app > nav.navbar {
    position: fixed; top: 0; left: 0; bottom: 0;
    width: var(--ui-rail-open);
    height: 100vh;
    padding: 0 !important;
    background: var(--ui-panel) !important;
    border-right: 1px solid var(--ui-border);
    box-shadow: none !important;
    align-items: stretch;
    transition: width .15s ease, flex-basis .15s ease;
    overflow: visible;
  }
  /* the rail is a grid so Notes / Notifications / Profile can sit side by side (or stacked) without moving the game's own nodes */
  html body #app > nav.navbar > .container-xxl {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: auto auto auto minmax(auto, 1fr) auto auto auto auto auto auto auto auto;
    overflow-y: auto; overflow-x: hidden; scrollbar-width: thin;
    align-items: center; align-content: stretch; gap: 0 6px;
    max-width: none; width: 100%; height: 100%;
    padding: 10px 8px !important;
  }
  html body #app > nav.navbar > .container-xxl > * { grid-column: 1 / -1; margin: 0 0 8px !important; min-width: 0; }
  html body #app > nav.navbar > .container-xxl > img { grid-row: 1; justify-self: center; }   /* logo */
  html body #app > nav.navbar > .container-xxl > .navbar-menu { grid-row: 2; align-self: stretch; }
  html body #app > nav.navbar > .container-xxl > #gtui-links { grid-row: 3; }
  html body #app > nav.navbar > .container-xxl > .btn-group { grid-row: 5; }
  html body #app > nav.navbar > .container-xxl > #gtui-stats2 { grid-row: 6; }
  html body #app > nav.navbar > .container-xxl > #gtui-keys { grid-row: 4; align-self: end; margin-bottom: 10px !important; }
  html body #app > nav.navbar > .container-xxl > #gtui-setbtn { grid-row: 10; }
  html body #app > nav.navbar > .container-xxl > #gtui-toggle { grid-row: 11; }
  html body #app > nav.navbar > .container-xxl > #gtui-ver { grid-row: 12; margin-bottom: 0 !important; }
  /* quick buttons: notifications | profile | notes */
  html body #app > nav.navbar > .container-xxl > [data-popup-id="notifications"],
  html body #app > nav.navbar > .container-xxl > .dropdown,
  html body #app > nav.navbar > .container-xxl > #gtui-notes {
    height: 38px; width: auto !important; display: flex !important; align-items: center; justify-content: center; position: relative;
    background: var(--ui-panel-2) !important; border: 1px solid var(--ui-border); border-radius: var(--ui-radius);
    padding: 0 !important; color: var(--ui-dim); cursor: pointer; opacity: 1;
  }
  html body #app > nav.navbar > .container-xxl > [data-popup-id="notifications"]:hover,
  html body #app > nav.navbar > .container-xxl > .dropdown:hover,
  html body #app > nav.navbar > .container-xxl > #gtui-notes:hover { border-color: var(--ui-accent); color: var(--ui-fg); }
  html body #app > nav.navbar > .container-xxl > [data-popup-id="notifications"] { grid-row: 7; grid-column: 1; }
  html body #app > nav.navbar > .container-xxl > .dropdown { grid-row: 7; grid-column: 2 / -1; }
  html body #app > nav.navbar > .container-xxl > #gtui-notes { grid-row: 7; grid-column: 3; }
  html body #app > nav.navbar > .container-xxl > [data-popup-id="notifications"] > svg,
  html body #app > nav.navbar > .container-xxl > #gtui-notes > svg { width: 20px; height: 20px; }
  html body #app > nav.navbar > .container-xxl > .dropdown > svg[data-bs-toggle] { width: 100% !important; height: 100% !important; padding: 6px; margin: 0 !important; }
  #gtui-notes-nav { cursor: pointer; }
  .gtui-dupe { display: none !important; }
  /* stacked / collapsed: one column, one button per row */
  html.gtui-collapsed body #app > nav.navbar > .container-xxl,
  html.gtui-qstack body #app > nav.navbar > .container-xxl { grid-template-columns: minmax(0, 1fr); }
  html.gtui-collapsed body #app > nav.navbar > .container-xxl > [data-popup-id="notifications"],
  html.gtui-qstack body #app > nav.navbar > .container-xxl > [data-popup-id="notifications"] { grid-column: 1; grid-row: 7; }
  html.gtui-collapsed body #app > nav.navbar > .container-xxl > .dropdown,
  html.gtui-qstack body #app > nav.navbar > .container-xxl > .dropdown { grid-column: 1; grid-row: 8; }
  html.gtui-collapsed body #app > nav.navbar > .container-xxl > #gtui-notes,
  html.gtui-qstack body #app > nav.navbar > .container-xxl > #gtui-notes { grid-column: 1; grid-row: 9; }
  /* optional sections */
  html.gtui-hide-links #gtui-links, html.gtui-hide-stats #gtui-stats2 { display: none !important; }
  html.gtui-hide-pills body #app > nav.navbar .btn-group { display: none !important; }
  /* sidebar on the right */
  html.gtui-right body #app > nav.navbar { left: auto; right: 0; border-right: 0; border-left: 1px solid var(--ui-border); }
  html.gtui-right body #app > main { margin-left: 0 !important; margin-right: var(--ui-rail-open) !important; }
  html.gtui-right.gtui-collapsed body #app > main { margin-right: var(--ui-rail-closed) !important; }
  html.gtui-right body #app > nav.navbar .dropdown-menu.show { inset: auto calc(var(--ui-rail-open) + 8px) 10px auto !important; }
  html.gtui-right.gtui-collapsed body #app > nav.navbar .dropdown-menu.show { right: calc(var(--ui-rail-closed) + 8px) !important; }
  html.gtui-right body .popover.popover-notif { inset: auto calc(var(--ui-rail-open) + 8px) 12px auto !important; }
  html.gtui-right.gtui-collapsed body .popover.popover-notif { right: calc(var(--ui-rail-closed) + 8px) !important; }
  html.gtui-right #gtui-set { left: auto; right: calc(var(--ui-rail-open) + 8px); }
  html.gtui-right.gtui-collapsed #gtui-set { right: calc(var(--ui-rail-closed) + 8px); }
  html body .navbar-menu {
    display: flex !important; min-height: auto !important;
    flex-direction: column !important;
    margin: 0 !important;
    gap: 2px;
    flex: 0 1 auto;
    overflow: visible;
  }
  html body .navbar-menu .nav-link {
    display: flex !important; align-items: center; gap: 10px; position: relative; text-align: left; line-height: 1.2;
    padding: 9px 12px !important;
    border-radius: var(--ui-radius);
    color: var(--ui-dim) !important;
    white-space: nowrap;
    border: 0 !important;
    border-left: 3px solid transparent !important;
    transition: background-color .12s, color .12s;
  }
  html body .navbar-menu .nav-link:hover { background: var(--ui-panel-2); color: var(--ui-fg) !important; }
  html body .navbar-menu .nav-link.active {
    background: var(--ui-panel-2);
    color: var(--ui-hi) !important;
    border-left-color: var(--ui-accent) !important;
  }
  /* the game drops its own labels at some widths; we supply them from data-gtui-label */
  /* the game paints its own active/hover underline on ::after (absolute, 2px, currentColor) – neutralise it and reuse ::after for the label */
  html body .navbar-menu .nav-link::after {
    content: none; position: static !important; inset: auto !important; height: auto !important; background: none !important;
    opacity: 1 !important; animation: none !important; box-shadow: none !important; transition: none !important; pointer-events: none;
    width: auto !important; max-width: none !important; margin: 0 !important;
  }
  html body .navbar-menu.navbar-menu-justified { width: auto !important; max-width: none !important; }
  html body .navbar-menu .nav-link[data-gtui-label]::after { content: attr(data-gtui-label); font-size: .92rem; }
  html body .navbar-menu .nav-link .iu { width: 1.15em; height: 1.15em; flex: 0 0 auto; }
  html body .navbar-menu .nav-link .ms-1 { margin-left: 0 !important; overflow: hidden; }

  /* resource pills: stack vertically in the rail */
  html body #app > nav.navbar .btn-group {
    flex-direction: column !important;
    width: 100%; gap: 4px;
  }
  html body #app > nav.navbar .btn-group > .btn {
    width: 100%; text-align: left; border-radius: var(--ui-radius) !important;
    margin: 0 !important; background: var(--ui-bg);
  }

  #gtui-toggle {
    align-self: stretch;
    background: transparent; color: var(--ui-dim);
    border: 1px solid var(--ui-border); border-radius: var(--ui-radius);
    padding: 6px 0; cursor: pointer; font-size: 12px; flex: 0 0 auto; line-height: 1;
  }
  #gtui-toggle::before { content: '« Collapse'; }
  html.gtui-collapsed #gtui-toggle::before { content: '»'; }
  #gtui-toggle:hover { color: var(--ui-fg); background: var(--ui-panel-2); }

  #gtui-ver { text-align: center; font-size: .66rem; color: var(--ui-dim); opacity: .7; margin-top: -4px; }

  /* collapsed rail: icons only */
  html.gtui-collapsed body #app > nav.navbar { width: var(--ui-rail-closed); }
  html.gtui-collapsed #gtui-ver { display: none; }
  html.gtui-collapsed .navbar-menu .nav-link .ms-1,
  html.gtui-collapsed .navbar-menu .nav-link[data-gtui-label]::after { display: none; }
  html.gtui-collapsed .navbar-menu .nav-link { justify-content: center; padding: 10px 0 !important; border-left-width: 0 !important; }
  html.gtui-collapsed #app > nav.navbar .btn-group > .btn { font-size: 10px; padding: 3px 2px; text-align: center; }
  html.gtui-collapsed #app > nav.navbar .btn-group > .btn .iu { display: none; }
  html.gtui-collapsed #app > nav.navbar > .container-xxl > img { width: 24px; height: auto; }
  html.gtui-collapsed #app > nav.navbar .dropdown,
  html.gtui-collapsed #app > nav.navbar [data-popup-id="notifications"] { align-self: center; }

  /* ============ CONTENT: use the whole screen ============ */
  html body main {
    flex: 1 1 0 !important; width: auto !important; min-width: 0; height: 100vh;
  }
  html body main.container-xxl {
    max-width: none !important;
    padding-left: 16px !important; padding-right: 16px !important;
  }
  /* pages that wrap their content in an inner .container-xxl (Exchange, Base, ...) */
  html body main > .container-xxl {
    max-width: none !important; padding: 14px 22px !important;
  }

  /* tables: drop Bootstrap's grey, tighten rows, keep headers visible */
  html body .table {
    --bs-table-bg: transparent; --bs-table-color: var(--ui-fg);
    --bs-table-hover-bg: var(--ui-panel-2); --bs-table-hover-color: #fff;
    --bs-table-border-color: var(--ui-border);
  }
  html body .table > :not(caption) > * > * { padding: .38rem .6rem; background-color: var(--bs-table-bg); }
  html body .table thead th {
    position: sticky; top: 0; z-index: 2; background: var(--ui-panel) !important;
    color: var(--ui-dim); font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; font-weight: 600;
  }
  html body .table tbody tr:hover > * { background: var(--ui-panel-2); }
  html body .table .io, html body .table .ai-st { width: 1.5em; height: 1.5em; }

  /* tabs (Exchange / My Offers / Contracts, Materials / Wishlist, ...) */
  html body .nav-tabs { border-bottom: 1px solid var(--ui-border) !important; }
  html body .nav-tabs .nav-link { color: var(--ui-dim) !important; background: transparent !important; border: 0 !important;
    border-bottom: 2px solid transparent !important; border-radius: 0 !important; padding: .55rem .9rem; }
  html body .nav-tabs .nav-link:hover { color: var(--ui-fg) !important; background: var(--ui-panel-2) !important; }
  html body .nav-tabs .nav-link.active { color: var(--ui-hi) !important; border-bottom-color: var(--ui-accent) !important; background: var(--ui-panel-2) !important; }

  /* form controls + outline buttons */
  html body .form-control, html body .form-select, html body .input-group-text {
    background-color: var(--ui-bg) !important; color: var(--ui-fg) !important; border-color: var(--ui-border) !important; }
  html body .btn-outline-secondary { color: var(--ui-dim); border-color: var(--ui-border); }
  html body .btn-outline-secondary.active, html body .btn-outline-secondary:hover { background: var(--ui-panel-2) !important; color: var(--ui-hi); border-color: var(--ui-border); }
  html body .btn-check:checked + .btn-outline-primary, html body .btn-outline-primary.active { background: var(--ui-accent) !important; border-color: var(--ui-accent) !important; color: var(--ui-accent-fg) !important; }
  html body .btn-outline-primary { color: var(--ui-fg); border-color: var(--ui-border); }
  html body .progress { background: var(--ui-bg); }

  html body .card { background: var(--ui-panel) !important; border-color: var(--ui-border) !important; border-radius: var(--ui-radius); }
  html body .card-header { background: var(--ui-panel-2) !important; border-color: var(--ui-border) !important; }
  html body .list-group-item { background: transparent !important; border-color: var(--ui-border) !important; color: var(--ui-fg); }
  html body .list-group-item-action:hover { background: var(--ui-panel-2) !important; }
  html body .list-group-item.active { background: var(--ui-panel-2) !important; border-left: 3px solid var(--ui-accent) !important; color: var(--ui-hi); }
  html body .btn-primary { background: var(--ui-accent) !important; border-color: var(--ui-accent) !important; color: var(--ui-accent-fg) !important; }
  html body .btn-secondary { background: var(--ui-panel-3) !important; border-color: var(--ui-border) !important; color: var(--ui-fg) !important; }
  html body .btn-secondary:hover { background: var(--ui-accent) !important; border-color: var(--ui-accent) !important; color: var(--ui-accent-fg) !important; }
  html body .dropdown-menu { background: var(--ui-panel-2) !important; border-color: var(--ui-border) !important; }
  html body .dropdown-item { color: var(--ui-fg) !important; }
  html body .dropdown-item:hover { background: var(--ui-accent) !important; }

  /* ============ SCREEN: Exchange (trade card + offers) ============ */
  html body .box-section { background: var(--ui-bg); border: 1px solid var(--ui-border); border-radius: var(--ui-radius); }
  html body .nav-tabs .nav-link.link-success { color: #4ade80 !important; }
  html body .nav-tabs .nav-link.link-danger { color: #f87171 !important; }
  html body .nav-tabs .nav-link.link-success.active { border-bottom-color: #4ade80 !important; }
  html body .nav-tabs .nav-link.link-danger.active { border-bottom-color: #f87171 !important; }
  html body .table .text-success { color: #4ade80 !important; }
  html body .table .text-warning { color: #fbbf24 !important; }
  html body .table .text-danger { color: #f87171 !important; }
  /* selected material row */
  html body .table tr.table-active > * { background: rgba(var(--ui-accent-rgb), .22) !important; color: var(--ui-hi); box-shadow: none; }
  /* offers depth bar: game paints it on <tbody> with a hard-coded #222 tail; tint that to our navy */
  html body .table tbody[style*="linear-gradient"] { background-color: #8f93c0 !important; background-blend-mode: multiply; }
  html body .badge-button { background: var(--ui-panel-2); color: var(--ui-dim); border: 1px solid var(--ui-border); }

  /* ============ SCREEN: Base (bases, fleet, building grid) ============ */
  html body .grid-default { grid-template-columns: repeat(auto-fill, minmax(116px, 1fr)) !important; gap: 8px !important; }
  html body .btn-building {
    background: var(--ui-panel-2) !important; border: 1px solid var(--ui-border) !important; color: var(--ui-fg) !important;
    border-radius: var(--ui-radius) !important; position: relative;
    transition: transform .1s ease, border-color .1s ease, box-shadow .1s ease;
  }
  html body .btn-building:hover { border-color: var(--ui-accent) !important; transform: translateY(-2px); box-shadow: 0 6px 14px rgba(0,0,0,.45); z-index: 1; }
  html body .btn-building[data-slot-status="Building"] { border-top: 2px solid var(--ui-accent) !important; }
  html body .btn-building[data-slot-status="Empty"] { background: transparent !important; border-style: dashed !important; }
  html body .btn-building[data-slot-status="Debris"],
  html body .btn-building[data-slot-status="Premium"] { background: transparent !important; opacity: .55; }
  html body .btn-building .btn-badge { background: var(--ui-accent) !important; color: var(--ui-accent-fg) !important; font-weight: 700; }
  html body .list-group-item-dark { background: transparent !important; color: var(--ui-fg) !important; border-color: var(--ui-border) !important; }
  html body .list-group-item-hover:hover { background: var(--ui-panel-2) !important; }
  html body .progress, html body .progress-bar { border-radius: 4px; }


  /* ============ EXCHANGE: EVE-style market  [categories | item list | order book] ============ */
  main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) {
    --bs-gutter-x: 0; --bs-gutter-y: 0;
    display: grid !important; margin: 0 !important; min-height: 0 !important; align-items: start; gap: 12px;
    grid-template-columns: minmax(140px, 190px) minmax(380px, 1fr);
  }
  main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel):has(> .col.order-first) {
    grid-template-columns: minmax(140px, 190px) minmax(400px, 1fr) minmax(360px, 1.3fr);
  }
  main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > * {
    width: auto !important; max-width: none !important; min-width: 0 !important; padding: 0 !important; margin: 0 !important; flex: none !important; grid-row: 1;
  }
  #gtui-cats { grid-column: 1; }
  #exchangeMaterialsPanel { grid-column: 2; }
  main > .container-xxl > .row.g-4 > .col.order-first { grid-column: 3; position: sticky; top: 12px; }

  #gtui-cats {
    position: sticky; top: 12px; display: flex; flex-direction: column; gap: 2px; padding: 6px;
    background: var(--ui-panel); border: 1px solid var(--ui-border); border-radius: var(--ui-radius);
    max-height: calc(100vh - 150px); overflow: auto;
  }
  #gtui-cats .hd { font-size: .68rem; text-transform: uppercase; letter-spacing: .08em; color: var(--ui-dim); padding: 4px 8px 6px; }
  #gtui-cats button {
    text-align: left; background: transparent; color: var(--ui-dim); border: 0; border-left: 3px solid transparent;
    border-radius: 6px; padding: 6px 9px; font-size: .88rem; cursor: pointer;
  }
  #gtui-cats button:hover { background: var(--ui-panel-2); color: var(--ui-fg); }
  #gtui-cats button.on { background: var(--ui-panel-2); color: var(--ui-hi); border-left-color: var(--ui-accent); font-weight: 600; }
  #typeFilter { display: none; }

  #exchangeMaterialsPanel .card-body, #exchangeTradeMatCard .card-body { max-height: calc(100vh - 150px); overflow: auto; }
  #exchangeMaterialsPanel .input-group { position: sticky; top: 0; z-index: 5; background: var(--ui-panel); padding-bottom: 6px; }
  #exchangeMaterialsPanel .table thead th { top: 44px; }
  #exchangeMaterialsPanel .table > :not(caption) > * > * { padding: .2rem .55rem; }
  #exchangeMaterialsPanel .table tr { cursor: pointer; }

  /* warehouse + ships strip: collapsed by default while on the Exchange tab */
  main > .container-xxl > .card > .card-header { display: flex; align-items: center; gap: 10px; }
  main > .container-xxl > .card > .card-header > ul { flex: 1 1 auto; }
  html:not(.gtui-xch-open) main > .container-xxl > .card:has(.nav-link[data-tab="exchange"].active) > .card-body { display: none; }
  #gtui-xch-toggle { flex: 0 0 auto; background: var(--ui-bg); color: var(--ui-dim); border: 1px solid var(--ui-border); border-radius: 6px; padding: 4px 10px; font-size: .8rem; cursor: pointer; }
  #gtui-xch-toggle:hover { color: var(--ui-hi); border-color: var(--ui-accent); }
  #gtui-xch-toggle::before { content: '▸  '; }
  html.gtui-xch-open #gtui-xch-toggle::before { content: '▾  '; }

  @media (max-width: 1180px) {
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel),
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel):has(> .col.order-first) { grid-template-columns: 1fr; }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > * { grid-row: auto; grid-column: 1 !important; position: static !important; }
    #gtui-cats { flex-direction: row; overflow-x: auto; max-height: none; }
    #gtui-cats .hd { display: none; }
    #gtui-cats button { white-space: nowrap; border-left: 0; border-bottom: 3px solid transparent; }
    #gtui-cats button.on { border-bottom-color: var(--ui-accent); }
    #exchangeMaterialsPanel .card-body, #exchangeTradeMatCard .card-body { max-height: none; }
  }

  /* ============ COMMAND PALETTE ============ */
  #gtui-pal { position: fixed; inset: 0; z-index: 2000; background: rgba(3,4,12,.65); display: none; align-items: flex-start; justify-content: center; padding-top: 14vh; }
  #gtui-pal.open { display: flex; }
  #gtui-pal .box { width: min(560px, 92vw); background: var(--ui-panel); border: 1px solid var(--ui-border); border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,.6); overflow: hidden; }
  #gtui-pal input { width: 100%; box-sizing: border-box; background: var(--ui-bg); color: var(--ui-fg); border: 0; border-bottom: 1px solid var(--ui-border); padding: 14px 16px; font-size: 1rem; outline: none; }
  #gtui-pal .it { padding: 9px 16px; cursor: pointer; color: var(--ui-dim); display: flex; justify-content: space-between; }
  #gtui-pal .it.sel { background: var(--ui-panel-2); color: var(--ui-hi); }
  #gtui-pal .it small { opacity: .6; }
  #gtui-pal .ft { padding: 6px 16px; font-size: .72rem; color: var(--ui-dim); border-top: 1px solid var(--ui-border); }

  /* ============ MARKET v2: own item list (sortable, with API prices) + info/chart card ============ */
  main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) { grid-template-rows: auto 1fr; }
  #gtui-cats, #exchangeMaterialsPanel { grid-row: 1 / span 2 !important; }
  #exchangeMaterialsPanel[data-gtui-ml] .card-body > table { display: none; }
  main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > #gtui-minfo { grid-column: 3 !important; grid-row: 1 !important; padding: 14px 16px !important; }
  main > .container-xxl > .row.g-4 > .col.order-first { grid-column: 3 !important; grid-row: 2 !important; position: static !important; }
  #exchangeMaterialsPanel .card-body, #exchangeTradeMatCard .card-body { max-height: none; overflow: visible; }
  #exchangeMaterialsPanel { position: sticky; top: 12px; align-self: start; }
  #exchangeMaterialsPanel .card-body { max-height: calc(100vh - 100px); overflow: auto; }

  #gtui-mlist { font-size: .9rem; }
  #gtui-mlist .h, #gtui-mlist .r {
    display: grid; grid-template-columns: minmax(90px, 1fr) 76px 76px 58px; align-items: center; column-gap: 6px; padding: 0 8px;
  }
  #gtui-mlist .h { position: sticky; top: 44px; z-index: 4; background: var(--ui-panel); border-bottom: 1px solid var(--ui-border); }
  #gtui-mlist .h button {
    background: none; border: 0; color: var(--ui-dim); font-size: .7rem; text-transform: uppercase; letter-spacing: .06em;
    font-weight: 600; padding: 7px 0; text-align: right; cursor: pointer; white-space: nowrap;
  }
  #gtui-mlist .h button:first-child { text-align: left; }
  #gtui-mlist .h button:hover, #gtui-mlist .h button.on { color: var(--ui-hi); }
  #gtui-mlist .h button.on::after { content: ' ▲'; font-size: .6rem; }
  #gtui-mlist .h button.on.desc::after { content: ' ▼'; }
  #gtui-mlist .r { height: 2rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,.04); border-left: 3px solid transparent; }
  #gtui-mlist .r:hover { background: var(--ui-panel-2); }
  #gtui-mlist .r.sel { background: rgba(var(--ui-accent-rgb), .2); border-left-color: var(--ui-accent); color: var(--ui-hi); }
  #gtui-mlist .r .n { display: flex; align-items: center; min-width: 0; gap: 8px; }
  #gtui-mlist .r .n span.t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #gtui-mlist .r .n svg.io { width: 22px; height: 22px; flex: 0 0 auto; margin: 0 !important; }
  #gtui-mlist .r .n .fav { color: #fbbf24; font-size: .7rem; }
  #gtui-mlist .r .n em { font-style: normal; font-size: .68rem; background: var(--ui-accent); color: var(--ui-accent-fg); border-radius: 9px; padding: 0 6px; }
  #gtui-mlist .r .p, #gtui-mlist .r .a, #gtui-mlist .r .d { text-align: right; font-variant-numeric: tabular-nums; }
  #gtui-mlist .r .a { color: var(--ui-dim); }
  #gtui-mlist .r .d { font-size: .8rem; }
  #gtui-mlist .up { color: #f87171; }       /* above average = pricier */
  #gtui-mlist .dn { color: #4ade80; }       /* below average = cheaper */
  #gtui-mlist .none { padding: 24px; text-align: center; color: var(--ui-dim); }
  #gtui-mlist .src { padding: 6px 10px; font-size: .7rem; color: var(--ui-dim); text-align: right; }

  #gtui-minfo { background: var(--ui-panel); border: 1px solid var(--ui-border); border-radius: var(--ui-radius); padding: 14px 16px; min-width: 0; }
  #gtui-minfo .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  #gtui-minfo .top svg.io { width: 40px; height: 40px; }
  #gtui-minfo .nm { font-size: 1.25rem; font-weight: 700; color: var(--ui-hi); line-height: 1.1; }
  #gtui-minfo .sub { color: var(--ui-dim); font-size: .78rem; }
  #gtui-minfo .big { margin-left: auto; text-align: right; }
  #gtui-minfo .big b { font-size: 1.6rem; color: var(--ui-hi); font-variant-numeric: tabular-nums; }
  #gtui-minfo .chip { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 10px; font-size: .78rem; font-weight: 600; background: var(--ui-panel-2); }
  #gtui-minfo .chip.up { color: #f87171; } #gtui-minfo .chip.dn { color: #4ade80; }
  #gtui-minfo .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin: 12px 0; }
  #gtui-minfo .stat { background: var(--ui-bg); border: 1px solid var(--ui-border); border-radius: 6px; padding: 6px 10px; }
  #gtui-minfo .stat span { display: block; font-size: .66rem; text-transform: uppercase; letter-spacing: .06em; color: var(--ui-dim); }
  #gtui-minfo .stat b { font-variant-numeric: tabular-nums; font-weight: 600; }
  #gtui-minfo .rng { display: flex; gap: 4px; justify-content: flex-end; margin-bottom: 4px; }
  #gtui-minfo .rng button { background: transparent; border: 1px solid var(--ui-border); color: var(--ui-dim); border-radius: 5px; padding: 1px 9px; font-size: .74rem; cursor: pointer; }
  #gtui-minfo .rng button.on { background: var(--ui-accent); border-color: var(--ui-accent); color: var(--ui-accent-fg); }
  #gtui-minfo .chart { position: relative; }
  #gtui-minfo .chart svg { display: block; width: 100%; height: auto; }
  #gtui-minfo .chart .tip { position: absolute; top: 0; pointer-events: none; background: #000c; border: 1px solid var(--ui-border); border-radius: 6px; padding: 3px 8px; font-size: .74rem; white-space: nowrap; display: none; transform: translateX(-50%); }
  #gtui-minfo .empty { padding: 28px; text-align: center; color: var(--ui-dim); font-size: .85rem; }

  @media (max-width: 1180px) {
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel),
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel):has(> .col.order-first) { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > #gtui-cats,
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > #exchangeMaterialsPanel,
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > #gtui-minfo,
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > .col.order-first { grid-column: 1 !important; grid-row: auto !important; position: static !important; }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > #gtui-cats { order: 1 !important; }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > #exchangeMaterialsPanel { order: 2 !important; }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > #gtui-minfo { order: 3 !important; }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > .col.order-first { order: 4 !important; }
    #exchangeMaterialsPanel .card-body { max-height: 70vh; }
    html body #app > nav.navbar .btn-group > .btn { font-size: 10px; padding: 3px 2px; text-align: center; }
  }

  /* ---- big screens: scale the UI up and use all the width ---- */
  @media (min-width: 2400px) { html { font-size: 17.5px !important; } }
  @media (min-width: 3000px) { html { font-size: 19px !important; } }
  #exchangeMaterialsPanel > .card { min-height: calc(100vh - 100px); }
  @media (min-width: 2300px) {
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel):has(> .col.order-first) {
      grid-template-columns: minmax(170px, 210px) minmax(520px, 0.9fr) minmax(520px, 1fr) minmax(560px, 1fr);
    }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > #gtui-minfo { grid-column: 3 !important; grid-row: 1 / span 2 !important; align-self: start; }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel) > .col.order-first { grid-column: 4 !important; grid-row: 1 / span 2 !important; }
  }

  /* notifications popover (the game's Popupik, popper-positioned for a top bar): pin it beside the sidebar */
  html body .popover.popover-notif {
    position: fixed !important; inset: auto auto 12px calc(var(--ui-rail-open) + 8px) !important; transform: none !important;
    width: 400px !important; max-width: calc(100vw - var(--ui-rail-open) - 24px) !important; margin: 0 !important; z-index: 1060;
    --bs-popover-bg: var(--ui-panel-2); --bs-popover-border-color: var(--ui-border); --bs-popover-header-bg: var(--ui-panel); --bs-popover-header-color: #fff; --bs-popover-body-color: var(--ui-fg);
  }
  html body .popover.popover-notif .popover-arrow { display: none; }
  html.gtui-collapsed body .popover.popover-notif { left: calc(var(--ui-rail-closed) + 8px) !important; max-width: calc(100vw - var(--ui-rail-closed) - 24px) !important; }
  @media (max-width: 1100px) { html body .popover.popover-notif { left: calc(var(--ui-rail-closed) + 8px) !important; max-width: calc(100vw - var(--ui-rail-closed) - 24px) !important; } }
  @media (max-width: 640px) { html body .popover.popover-notif { inset: auto 8px 66px 8px !important; width: auto !important; max-width: none !important; } }

  /* ============ NAV: profile stats + dropdown that opens on-screen ============ */
  #gtui-stats { display: none !important; }   /* leftover element from an older copy of this script */
  #gtui-stats2 { display: flex; flex-direction: column; gap: 4px; }
  #gtui-stats2 div { display: flex; justify-content: space-between; align-items: baseline; background: var(--ui-bg); border: 1px solid var(--ui-border); border-radius: var(--ui-radius); padding: 4px 10px; font-size: .82rem; }
  #gtui-stats2 span { color: var(--ui-dim); font-size: .68rem; text-transform: uppercase; letter-spacing: .06em; }
  #gtui-stats2 b { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--ui-fg); }
  html.gtui-collapsed #gtui-stats2 { display: none; }
  html body #app > nav.navbar .dropdown-menu.show {
    position: fixed !important; inset: auto auto 10px calc(var(--ui-rail-open) + 8px) !important; transform: none !important; margin: 0 !important;
    max-height: calc(100vh - 20px); overflow-y: auto; min-width: 230px;
  }
  html.gtui-collapsed body #app > nav.navbar .dropdown-menu.show { left: calc(var(--ui-rail-closed) + 8px) !important; }
  @media (max-width: 640px) { html body #app > nav.navbar .dropdown-menu.show { inset: auto 8px 64px 8px !important; } }
  html.gtui-silent .modal, html.gtui-silent .modal-backdrop { opacity: 0 !important; pointer-events: none !important; transition: none !important; }

  /* ============ OTHER SCREENS: Research, Missions, Galaxy, modals ============ */
  html body .bg-body { background-color: var(--ui-bg) !important; }
  html body .bg-dark:not(.badge):not(.btn) { background-color: var(--ui-panel-2) !important; border-color: var(--ui-border) !important; }
  html body .modal-content { background: var(--ui-panel); border: 1px solid var(--ui-border); border-radius: 12px; color: var(--ui-fg); }
  html body .modal-header { background: var(--ui-panel-2); border-bottom: 1px solid var(--ui-border); }
  html body .modal-footer { border-top: 1px solid var(--ui-border); }
  html body .btn-close { filter: invert(1) grayscale(1) brightness(1.4); opacity: .7; }
  html body .offcanvas { background: var(--ui-panel) !important; color: var(--ui-fg); border-color: var(--ui-border) !important; }
  html body .offcanvas-body.bg-dark { background: var(--ui-panel) !important; }
  html body .h5.fv-smallcaps { color: var(--ui-fg); border-bottom-color: var(--ui-border) !important; letter-spacing: .04em; }

  main .row.row-cols-1.row-cols-md-2.g-3 {
    --bs-gutter-x: 0; --bs-gutter-y: 0; display: grid !important; margin: 0 0 16px !important; gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr));
  }
  main .row.row-cols-1.row-cols-md-2.g-3 > .col { width: auto !important; max-width: none !important; padding: 0 !important; margin: 0 !important; flex: none !important; }
  html body .card.border-left-info { border-left: 3px solid #38bdf8 !important; }
  html body .card.border-left-info .card-header { background: var(--ui-panel-2) !important; }
  html body .progress-lg, html body .progress-sm { background: var(--ui-bg) !important; }
  html body [data-popup-id="techLevelInfo"] { border-radius: 8px !important; border-color: var(--ui-border) !important; overflow: hidden; }
  html body .btn-material, html body .btn-materialsm { border-radius: 8px; }
  html body .card-collapsible > .card-header { cursor: pointer; }
  html body .card-collapsible > .card-header:hover { background: var(--ui-panel-3) !important; }

  /* ============ solid popovers / context menus (right-click menu in chat etc.) ============ */
  html body .popover {
    --bs-popover-bg: var(--ui-panel-2); --bs-popover-border-color: var(--ui-border); --bs-popover-header-bg: var(--ui-panel);
    --bs-popover-header-color: #fff; --bs-popover-body-color: var(--ui-fg);
    background-color: var(--ui-panel-2) !important; color: var(--ui-fg); border: 1px solid var(--ui-border) !important;
    border-radius: 10px; box-shadow: 0 12px 34px rgba(0,0,0,.6); overflow: hidden;
  }
  html body .popover .popover-header { background: var(--ui-panel) !important; color: var(--ui-hi); border-bottom: 1px solid var(--ui-border); }
  html body .popover .popover-body { background: var(--ui-panel-2) !important; color: var(--ui-fg); }
  html body .popover .list-group { --bs-list-group-bg: transparent; }
  html body .popover .list-group-item { background: transparent !important; color: var(--ui-fg) !important; border-color: var(--ui-border) !important; }
  html body .popover .list-group-item-action:hover { background: var(--ui-panel-3) !important; color: var(--ui-hi) !important; }

  /* ============ hide images (settings) ============ */
  html.gtui-hide-avatars .com-group > svg.avatar { display: none !important; }
  html.gtui-hide-logos main svg[shape-rendering="crispEdges"], html.gtui-hide-logos .modal svg[shape-rendering="crispEdges"],
  html.gtui-hide-logos .popover svg[shape-rendering="crispEdges"], html.gtui-hide-logos .offcanvas svg[shape-rendering="crispEdges"] { display: none !important; }
  html.gtui-hide-portraits svg.as { display: none !important; }

  /* ============ settings panel ============ */
  #gtui-setbtn { margin-top: auto; align-self: stretch; background: transparent; color: var(--ui-dim); border: 1px solid var(--ui-border); border-radius: var(--ui-radius); padding: 6px 0; cursor: pointer; font-size: 12px; flex: 0 0 auto; line-height: 1; }
  #gtui-setbtn:hover { color: var(--ui-fg); background: var(--ui-panel-2); }
  #gtui-setbtn::before { content: '⚙  Settings'; }
  html.gtui-collapsed #gtui-setbtn::before { content: '⚙'; }
  #gtui-setbtn + #gtui-toggle { margin-top: 0; }
  #gtui-set { position: fixed; z-index: 1065; left: calc(var(--ui-rail-open) + 8px); bottom: 12px; width: 340px; max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); overflow-y: auto;
    background: var(--ui-panel-2); color: var(--ui-fg); border: 1px solid var(--ui-border); border-radius: 12px; box-shadow: 0 16px 44px rgba(0,0,0,.65); padding: 14px 16px; display: none; font-size: .9rem; }
  html.gtui-collapsed #gtui-set { left: calc(var(--ui-rail-closed) + 8px); }
  #gtui-set.open { display: block; }
  #gtui-set .hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  #gtui-set .hd b { font-size: 1.05rem; color: var(--ui-hi); }
  #gtui-set button.x { background: none; border: 0; color: var(--ui-dim); font-size: 1rem; cursor: pointer; }
  #gtui-set .sec { margin: 12px 0 6px; font-size: .68rem; text-transform: uppercase; letter-spacing: .08em; color: var(--ui-dim); }
  #gtui-set .themes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  #gtui-set .th { display: flex; align-items: center; gap: 8px; background: var(--ui-bg); color: var(--ui-fg); border: 1px solid var(--ui-border); border-radius: 8px; padding: 6px 8px; cursor: pointer; text-align: left; font-size: .85rem; }
  #gtui-set .th:hover { border-color: var(--ui-dim); }
  #gtui-set .th.on { border-color: var(--ui-accent); box-shadow: 0 0 0 1px var(--ui-accent) inset; }
  #gtui-set .th i { flex: 0 0 auto; width: 26px; height: 26px; border-radius: 6px; background: linear-gradient(135deg, var(--b) 0 50%, var(--a) 50% 100%); border: 1px solid #ffffff22; }
  #gtui-set label.rw, #gtui-set label.chk { display: flex; align-items: center; gap: 8px; margin: 6px 0; cursor: pointer; }
  #gtui-set label.rw { justify-content: space-between; }
  #gtui-set input[type=color] { width: 44px; height: 28px; padding: 0; border: 1px solid var(--ui-border); border-radius: 6px; background: none; cursor: pointer; }
  #gtui-set select { background: var(--ui-bg); color: var(--ui-fg); border: 1px solid var(--ui-border); border-radius: 6px; padding: 3px 6px; }
  #gtui-set .sm { background: transparent; border: 1px solid var(--ui-border); color: var(--ui-dim); border-radius: 6px; padding: 2px 8px; cursor: pointer; font-size: .78rem; }
  #gtui-set .sm:hover { color: var(--ui-hi); border-color: var(--ui-accent); }
  #gtui-set .cust { margin-top: 8px; padding: 8px 10px; background: var(--ui-bg); border: 1px solid var(--ui-border); border-radius: 8px; }
  #gtui-set .crow { display: flex; gap: 8px; margin-top: 8px; }
  .gtui-blocked { display: none !important; }
  #gtui-set .blk { display: flex; gap: 6px; }
  #gtui-set .blk input { flex: 1 1 auto; min-width: 0; background: var(--ui-bg); color: var(--ui-fg); border: 1px solid var(--ui-border); border-radius: 6px; padding: 3px 8px; }
  #gtui-set .blist { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  #gtui-set .bchip { display: inline-flex; align-items: center; gap: 6px; background: var(--ui-bg); border: 1px solid var(--ui-border); border-radius: 14px; padding: 1px 4px 1px 10px; font-size: .82rem; }
  #gtui-set .bchip button { background: none; border: 0; color: var(--ui-dim); cursor: pointer; padding: 0 5px; }
  #gtui-set .bchip button:hover { color: var(--ui-fg); }
  #gtui-set .note { color: var(--ui-dim); font-size: .74rem; margin-top: 8px; }

  /* ============ sidebar: external links ============ */
  #gtui-links { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--ui-border); }
  #gtui-links .hd { font-size: .64rem; text-transform: uppercase; letter-spacing: .08em; color: var(--ui-dim); padding: 0 12px 4px; }
  #gtui-links a { display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-radius: var(--ui-radius); color: var(--ui-dim); text-decoration: none; font-size: .9rem; white-space: nowrap; }
  #gtui-links a:hover { background: var(--ui-panel-2); color: var(--ui-fg); }
  #gtui-links a i { font-style: normal; flex: 0 0 auto; width: 1.7em; text-align: center; font-size: .62rem; font-weight: 700; border: 1px solid var(--ui-border); border-radius: 5px; padding: 1px 0; }
  #gtui-links a:hover i { border-color: var(--ui-accent); color: var(--ui-accent); }
  #gtui-links a::after { content: '↗'; margin-left: auto; opacity: .45; font-size: .8em; }
  html.gtui-collapsed #gtui-links .hd, html.gtui-collapsed #gtui-links a span, html.gtui-collapsed #gtui-links a::after { display: none; }
  html.gtui-collapsed #gtui-links a { justify-content: center; padding: 7px 0; }
  @media (max-width: 1100px) {
    #gtui-links .hd, #gtui-links a span, #gtui-links a::after { display: none; }
    #gtui-links a { justify-content: center; padding: 7px 0; }
  }
  @media (max-width: 640px) { #gtui-links { display: none; } }

  /* ============ EXCHANGE: Wishlist tab has no category tree -> drop the empty first column ============ */
  @media (min-width: 1181px) {
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel):not(:has(> #gtui-cats)) { grid-template-columns: minmax(400px, 1fr) minmax(360px, 1.1fr); }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel):not(:has(> #gtui-cats)) > #exchangeMaterialsPanel { grid-column: 1 !important; }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel):not(:has(> #gtui-cats)) > #gtui-minfo,
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel):not(:has(> #gtui-cats)) > .col.order-first { grid-column: 2 !important; }
  }
  @media (min-width: 2300px) {
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel):not(:has(> #gtui-cats)):has(> .col.order-first) { grid-template-columns: minmax(520px, 0.9fr) minmax(520px, 1fr) minmax(560px, 1fr); }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel):not(:has(> #gtui-cats)) > #gtui-minfo { grid-column: 2 !important; }
    main > .container-xxl > .row.g-4:has(#exchangeMaterialsPanel):not(:has(> #gtui-cats)) > .col.order-first { grid-column: 3 !important; }
  }
  /* wishlist table: roomier rows, solid add-field dropdown */
  #exchangeMaterialsPanel .table td { vertical-align: middle; }
  #exchangeMaterialsPanel #maInputField { min-width: 160px; }
  #exchangeMaterialsPanel .dropdown-menu-scrollable { background: var(--ui-panel-2) !important; }

  /* ============ SCREEN: Research ============ */
  html body .card-collapsible .d-grid.gap-1 { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)) !important; gap: 8px !important; }
  html body .card-collapsible button[data-popup-id="techLevelInfo"] {
    border: 1px solid var(--ui-border) !important; border-radius: var(--ui-radius) !important; overflow: hidden; text-align: left;
    transition: transform .1s ease, border-color .1s ease;
  }
  html body .card-collapsible button[data-popup-id="techLevelInfo"]:hover { border-color: var(--ui-accent) !important; transform: translateY(-1px); }
  html body .card-collapsible button[data-popup-id="techLevelInfo"] .container { max-width: none; width: 100%; padding: 0; margin: 0; }
  html body .card-collapsible button[data-popup-id="techLevelInfo"] .row { height: auto !important; min-height: 72px; margin: 0; flex-wrap: nowrap; }
  html body .card-collapsible button[data-popup-id="techLevelInfo"] .row > .col-3 { flex: 0 0 44px; width: 44px; background: var(--ui-panel-3) !important; color: var(--ui-hi); font-weight: 700; font-size: 1.05rem; }
  html body .card-collapsible button[data-popup-id="techLevelInfo"] .row > .col:not(.col-3) { padding: 6px !important; align-content: flex-start; }
  html body .card-collapsible button[data-popup-id="techLevelInfo"] .bg-body { background: rgba(0,0,0,.35) !important; }
  html body .card-collapsible button.btn-success[data-popup-id="techLevelInfo"] { background: rgba(34,197,94,.16) !important; border-color: rgba(74,222,128,.55) !important; color: #d6ffe6; }
  html body .card-collapsible button.btn-success[data-popup-id="techLevelInfo"] .row > .col-3 { background: #16a34a !important; }
  html body .card-collapsible button.btn-secondary[data-popup-id="techLevelInfo"] { background: var(--ui-panel) !important; opacity: .8; }
  html body .card-collapsible .d-grid.gap-1 > .btn:last-child:not([data-popup-id]) { display: none; }
  html body .card-collapsible { margin-top: 10px !important; }
  html body .card-collapsible > .card-header { display: flex; align-items: center; gap: 10px; font-weight: 600; }
  #gtui-rs { position: sticky; top: 0; z-index: 20; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 12px 0 4px; padding: 8px 10px; background: var(--ui-panel); border: 1px solid var(--ui-border); border-radius: var(--ui-radius); }
  #gtui-rs button { display: inline-flex; align-items: center; gap: 6px; background: var(--ui-panel-2); color: var(--ui-fg); border: 1px solid var(--ui-border); border-radius: 18px; padding: 3px 11px 3px 8px; font-size: .84rem; cursor: pointer; }
  #gtui-rs button:hover { border-color: var(--ui-accent); color: var(--ui-hi); }
  #gtui-rs button svg { width: 1.15em; height: 1.15em; }
  #gtui-rs button em { font-style: normal; font-size: .72rem; background: var(--ui-bg); border-radius: 9px; padding: 0 7px; color: var(--ui-dim); }
  #gtui-rs button.has em { background: #16a34a; color: var(--ui-hi); }
  #gtui-rs .sp { flex: 1 1 auto; }
  #gtui-rs button.ctl { border-radius: 6px; padding: 3px 10px; color: var(--ui-dim); }

  /* ============ SCREEN: HR (roster / headhunting / auction) ============ */
  html body .box-section-hover:hover { background-color: var(--ui-panel-2) !important; }
  html body .btn.roster-hover:hover { border-color: var(--ui-accent) !important; }
  html body .btn.roster-hover, html body .btn.roster-hover-success { border-radius: 8px; }

  /* ============ SCREEN: Comms ============ */
  /* channel column scales with screen instead of fixed col-3 */
  html body main .row > .col-3 { flex: 0 0 clamp(220px, 16vw, 340px); width: clamp(220px, 16vw, 340px); }
  html body .com-group { margin-bottom: 6px; }
  html body .com-group .avatar { width: 28px; height: 28px; }
  html body .com-header { background: transparent !important; padding: 0 !important; font-size: .82rem; }
  html body .com-msg { background: transparent !important; padding: 1px 0 !important; line-height: 1.35; }
  html body .com-msg:hover { background: var(--ui-panel-2) !important; border-radius: 4px; }
  html body .card-footer textarea.form-control { background: var(--ui-bg) !important; min-height: 44px !important; }

  @media (min-width: 768px) {
    html body main > .container-xxl > .row > .col-md-2 { flex: 0 0 clamp(250px, 14vw, 340px); width: clamp(250px, 14vw, 340px); }
  }

  /* ---- Comms options (settings): chat width cap, channels/contacts on the right, hide contacts ---- */
  html body .com-header b { font-weight: 700; letter-spacing: .01em; }
  html body main > .row.h-100 { justify-content: center; }
  html body main > .row.h-100 > .col.min-w-0 { max-width: var(--gtui-chatmax, none); }
  html.gtui-chat-right body main > .row.h-100 > .col-3 { order: 2; }
  html.gtui-chat-right body main > .row.h-100 > .col.min-w-0 { order: 1; }
  html.gtui-hide-contacts body main > .row.h-100 > .col-3 > .card:nth-of-type(2),
  html.gtui-hide-contacts body main > .row.h-100 > .col-3 > .card:nth-of-type(2) ~ .text-end { display: none; }

  .gtui-tr { margin-top: 2px; padding: 1px 0 1px 8px; border-left: 2px solid var(--ui-accent); color: var(--ui-dim); font-style: italic; font-size: .92em; }
  .gtui-tr::before { content: attr(data-l) '  '; font-style: normal; font-size: .72em; text-transform: uppercase; letter-spacing: .06em; opacity: .8; }

  /* leave room under the last message for the game's "X is typing" overlay */
  html body main .card-body.scroolbar-fix-right { padding-bottom: 2.1rem !important; }
  #gtui-out { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; padding: 5px 14px; font-size: .8rem; color: var(--ui-dim); background: var(--ui-panel); border-top: 1px solid var(--ui-border); }
  #gtui-out .ic { color: var(--ui-accent); font-size: .95em; letter-spacing: -.05em; }
  #gtui-out .l { white-space: nowrap; }
  #gtui-out select { background: var(--ui-bg); color: var(--ui-fg); border: 1px solid var(--ui-border); border-radius: 6px; padding: 2px 8px; max-width: 170px; }
  #gtui-out button { background: rgba(var(--ui-accent-rgb), .18); color: var(--ui-fg); border: 1px solid var(--ui-accent); border-radius: 6px; padding: 2px 14px; cursor: pointer; font-weight: 600; }
  #gtui-out button:hover { background: var(--ui-accent); color: var(--ui-accent-fg); }
  #gtui-out .tip { margin-left: auto; opacity: .75; font-size: .92em; }
  #gtui-out .tip b { color: var(--ui-fg); font-weight: 600; }
  @media (max-width: 760px) { #gtui-out .tip { display: none; } }

  /* compact channels & contacts: icons only, slides open on hover (desktop widths) */
  @media (min-width: 768px) {
    html.gtui-chan-compact body main > .row.h-100 > .col-3 { flex: 0 0 64px; width: 64px !important; min-width: 64px !important; overflow-x: hidden; transition: width .15s ease, margin .15s ease; position: relative; z-index: 30; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3 .list-group-item > div,
    html.gtui-chan-compact body main > .row.h-100 > .col-3 .card-header { font-size: 0; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3 .list-group-item { justify-content: center; padding-left: 0; padding-right: 0; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3 .list-group-item > div { text-align: center; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3 svg.iu, html.gtui-chan-compact body main > .row.h-100 > .col-3 svg.io { width: 1.35rem; height: 1.35rem; margin: 0 !important; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3 .badge { font-size: .6rem; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3 .card-header .btn, html.gtui-chan-compact body main > .row.h-100 > .col-3 > .text-end,
    html.gtui-chan-compact body main > .row.h-100 > .col-3 > .d-flex, html.gtui-chan-compact body main > .row.h-100 > .col-3 .list-group-item-secondary { display: none !important; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3:hover, html.gtui-chan-compact body main > .row.h-100 > .col-3:focus-within { flex-basis: 300px; width: 300px !important; margin-right: -236px; background: var(--ui-bg); box-shadow: 8px 0 24px rgba(0,0,0,.5); }
    html.gtui-chan-compact.gtui-chat-right body main > .row.h-100 > .col-3:hover { margin-right: 0; margin-left: -236px; box-shadow: -8px 0 24px rgba(0,0,0,.5); }
    html.gtui-chan-compact body main > .row.h-100 > .col-3:hover .list-group-item > div, html.gtui-chan-compact body main > .row.h-100 > .col-3:hover .card-header { font-size: 1rem; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3:hover .list-group-item { justify-content: space-between; padding-left: 1rem; padding-right: 1rem; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3:hover .list-group-item > div { text-align: left; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3:hover svg.iu, html.gtui-chan-compact body main > .row.h-100 > .col-3:hover svg.io { margin-right: .25rem !important; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3:hover .card-header .btn, html.gtui-chan-compact body main > .row.h-100 > .col-3:hover > .text-end { display: inline-flex; }
    html.gtui-chan-compact body main > .row.h-100 > .col-3:hover > .d-flex, html.gtui-chan-compact body main > .row.h-100 > .col-3:hover .list-group-item-secondary { display: flex !important; }
  }

  /* phones: channels/contacts stack above the chat instead of squeezing it */
  @media (max-width: 767px) {
    html body main > .row.h-100 { flex-wrap: nowrap; flex-direction: column; }
    html body main > .row.h-100 > .col-3 { flex: 0 0 auto; width: 100% !important; min-width: 0 !important; max-height: 34vh; order: 0 !important; }
    html body main > .row.h-100 > .col.min-w-0 { flex: 1 1 0; width: 100%; max-width: none; min-height: 0; order: 1 !important; }
  }

  /* shortcuts hint in the sidebar's spare space */
  #gtui-keys { font-size: .74rem; color: var(--ui-dim); line-height: 1.7; padding: 8px 10px; border: 1px dashed var(--ui-border); border-radius: var(--ui-radius); }
  #gtui-keys .hd { font-size: .64rem; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 2px; }
  #gtui-keys div.r { display: flex; justify-content: space-between; gap: 8px; }
  #gtui-keys kbd { background: var(--ui-panel-2); color: var(--ui-fg); border: 1px solid var(--ui-border); border-radius: 4px; padding: 0 5px; font: inherit; font-size: .95em; white-space: nowrap; }
  html.gtui-hide-keys #gtui-keys, html.gtui-collapsed #gtui-keys { display: none !important; }
  @media (max-height: 1000px), (max-width: 1100px) { #gtui-keys { display: none !important; } }

  /* compact channels: with company logos hidden, show initials so the strip isn't blank */
  @media (min-width: 768px) {
    html.gtui-chan-compact.gtui-hide-logos body main > .row.h-100 > .col-3 .list-group-item[data-gtui-i]::before { content: attr(data-gtui-i); font-size: .78rem; font-weight: 700; color: var(--ui-dim); }
    html.gtui-chan-compact.gtui-hide-logos body main > .row.h-100 > .col-3:hover .list-group-item[data-gtui-i]::before { display: none; }
  }
  /* narrow rail: show money as 454M instead of overflowing the 56px strip */
  html.gtui-collapsed #app > nav.navbar .btn-group > .btn { font-size: 0 !important; padding: 4px 2px; }
  html.gtui-collapsed #app > nav.navbar .btn-group > .btn::after { content: attr(data-gtui-s); font-size: 10px; letter-spacing: -.02em; }
  @media (max-width: 1100px) and (min-width: 641px) {
    #app > nav.navbar .btn-group > .btn { font-size: 0 !important; padding: 4px 2px; text-align: center; }
    #app > nav.navbar .btn-group > .btn::after { content: attr(data-gtui-s); font-size: 10px; letter-spacing: -.02em; }
  }

  /* ============ RESPONSIVE ============ */
  /* very wide: cap line length of chat so it stays readable */
  @media (min-width: 2200px) {
    html body .com-msg, html body .com-header { max-width: 1400px; }
  }
  /* tablet: force the collapsed rail */
  @media (max-width: 1100px) {
    html body #app > nav.navbar { width: var(--ui-rail-closed); }
    html body #app > main { margin-left: var(--ui-rail-closed) !important; }
    html.gtui-right body #app > main { margin-left: 0 !important; margin-right: var(--ui-rail-closed) !important; }
    html body #app > nav.navbar > .container-xxl { grid-template-columns: minmax(0, 1fr); }
    html body #app > nav.navbar > .container-xxl > [data-popup-id="notifications"] { grid-column: 1; grid-row: 7; }
    html body #app > nav.navbar > .container-xxl > .dropdown { grid-column: 1; grid-row: 8; }
    html body #app > nav.navbar > .container-xxl > #gtui-notes { grid-column: 1; grid-row: 9; }
    #gtui-ver { display: none; }
    .navbar-menu .nav-link .ms-1, .navbar-menu .nav-link[data-gtui-label]::after { display: none !important; }
    .navbar-menu .nav-link { justify-content: center; padding: 10px 0 !important; border-left-width: 0 !important; }
    #app > nav.navbar .btn-group > .btn .iu { display: none; }
    #gtui-toggle { display: none; }
  }
  /* phone: rail becomes a bottom tab bar */
  @media (max-width: 640px) {
    html body #app > nav.navbar { position: fixed; top: auto; left: 0; right: 0; bottom: 0; width: 100%; height: auto; border-right: 0; border-top: 1px solid var(--ui-border); }
    html body #app > nav.navbar > .container-xxl { display: flex !important; flex-direction: row !important; align-items: center; padding: 4px !important; overflow-x: auto; height: auto; gap: 6px; }
    html body #app > nav.navbar > .container-xxl > * { margin: 0 !important; flex: 0 0 auto; }
    html body #app > nav.navbar > .container-xxl > .navbar-menu { flex: 1 1 auto; }
    html body #app > nav.navbar > .container-xxl > [data-popup-id="notifications"], html body #app > nav.navbar > .container-xxl > .dropdown, html body #app > nav.navbar > .container-xxl > #gtui-notes { width: 40px !important; }
    html body #app > main { margin-left: 0 !important; margin-bottom: 58px; height: calc(100vh - 58px); }
    html body .navbar-menu { flex-direction: row !important; overflow: visible; }
    html body .navbar-menu .nav-link { border-left: 0 !important; border-bottom: 2px solid transparent !important; padding: 8px 10px !important; }
    html body .navbar-menu .nav-link.active { border-bottom-color: var(--ui-accent) !important; }
    #app > nav.navbar .btn-group, #app > nav.navbar > .container-xxl > img, #gtui-ver, #gtui-stats2, #gtui-setbtn { display: none !important; }
  }
  `;

  function injectCss() {
    if (document.getElementById('gtui-css')) return;
    const s = document.createElement('style');
    s.id = 'gtui-css';
    s.textContent = CSS;
    // append last so we win ties against other userscripts' styles
    (document.head || root).appendChild(s);
  }

  function applyCollapsed(v) {
    root.classList.toggle('gtui-collapsed', v);
    store.set(v);
  }

  const LABELS = {
    'space-station-moon': 'Base', 'right-left': 'Exchange', 'solar-system': 'Galaxy',
    'randd': 'R&D', 'user-tie': 'HR', 'clipboard-check': 'Missions', 'message-lines': 'Comms', 'users': 'Guild',
  };
  function labelNav() {
    document.querySelectorAll('.navbar-menu > .nav-link').forEach((a) => {
      if (a.querySelector('.ms-1')) { a.removeAttribute('data-gtui-label'); return; }   // game shows its own
      const use = a.querySelector('svg use');
      const id = use && (use.getAttribute('xlink:href') || use.getAttribute('href') || '').split('#')[1];
      if (id && LABELS[id] && a.getAttribute('data-gtui-label') !== LABELS[id]) a.setAttribute('data-gtui-label', LABELS[id]);
    });
  }

  function ensureToggle() {
    const bar = document.querySelector('#app > nav.navbar > .container-xxl');
    if (!bar || document.getElementById('gtui-toggle')) return;
    const b = document.createElement('button');
    b.id = 'gtui-toggle';
    b.type = 'button';
    b.title = 'Collapse / expand sidebar  ( [ )';
    b.addEventListener('click', () => applyCollapsed(!root.classList.contains('gtui-collapsed')));
    const sb = document.createElement('button');
    sb.id = 'gtui-setbtn';
    sb.type = 'button';
    sb.title = 'Themes & options';
    sb.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(); });
    bar.appendChild(sb);
    bar.appendChild(b);
    const v = document.createElement('div');
    v.id = 'gtui-ver';
    v.textContent = 'Sleek UI v0.9.33';
    bar.appendChild(v);
  }


  /* ---------- Exchange: category tree (drives the game's own #typeFilter select) ---------- */
  let catSig = '';
  function syncCats() {
    const sel = document.getElementById('typeFilter');
    const row = sel && sel.closest('main > .container-xxl > .row.g-4');
    let tree = document.getElementById('gtui-cats');
    if (!sel || !row) { if (tree) tree.remove(); catSig = ''; return; }
    if (!tree || tree.parentElement !== row) {
      if (tree) tree.remove();
      tree = document.createElement('div');
      tree.id = 'gtui-cats';
      row.prepend(tree);
      catSig = '';
      tree.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-v]');
        const cur = document.getElementById('typeFilter');
        if (!b || !cur) return;
        cur.value = b.dataset.v;
        cur.dispatchEvent(new Event('change', { bubbles: true }));
        requestAnimationFrame(syncCats);
      });
    }
    const opts = [...sel.options];
    const sig = opts.map((o) => o.value + ':' + o.text).join('|');
    if (sig !== catSig) {
      catSig = sig;
      tree.innerHTML = '<div class="hd">Market groups</div>' +
        opts.map((o) => '<button type="button" data-v="' + o.value + '">' + (o.value === '0' ? 'All items' : o.text) + '</button>').join('');
    }
    tree.querySelectorAll('button[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === sel.value));
  }

  /* ---------- Exchange: warehouse/ships strip toggle ---------- */
  const XKEY = 'gtui:xch-open';
  function syncXchToggle() {
    const hdr = document.querySelector('main > .container-xxl > .card > .card-header');
    const isEx = hdr && hdr.querySelector('.nav-link[data-tab="exchange"].active');   // only meaningful on the Exchange sub-tab
    let b = document.getElementById('gtui-xch-toggle');
    if (!isEx) { if (b) b.remove(); return; }
    if (!b || b.parentElement !== hdr) {
      if (b) b.remove();
      b = document.createElement('button');
      b.id = 'gtui-xch-toggle'; b.type = 'button'; b.textContent = 'Warehouse & ships';
      b.title = 'Show / hide your warehouse and ship cargo';
      b.addEventListener('click', () => {
        const open = root.classList.toggle('gtui-xch-open');
        try { localStorage.setItem(XKEY, open ? '1' : '0'); } catch (e) { /* ignore */ }
      });
      hdr.appendChild(b);
    }
  }
  try { root.classList.toggle('gtui-xch-open', localStorage.getItem(XKEY) === '1'); } catch (e) { /* ignore */ }

  /* ---------- Command palette  ( Ctrl+K  or  /  ) ---------- */
  const hrefOf = (u) => (u.getAttribute('xlink:href') || u.getAttribute('href') || '');
  function navLink(id) {
    return [...document.querySelectorAll('.navbar-menu > .nav-link')].find((a) => {
      const u = a.querySelector('svg use');
      return u && hrefOf(u).endsWith('#' + id);
    });
  }
  function setInput(el, v) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function searchMarket(q) {
    if (!document.getElementById('nameFilter')) { const l = navLink('right-left'); if (l) l.click(); }
    let tries = 0;
    const t = setInterval(() => {
      const f = document.getElementById('nameFilter');
      if (f || ++tries > 40) {
        clearInterval(t);
        if (!f) return;
        setInput(f, q);
        setTimeout(() => {
          const r = document.querySelector('#exchangeMaterialsPanel tbody tr');
          if (r) r.click();
        }, 200);
      }
    }, 100);
  }

  let pal, palIn, palList, palItems = [], palSel = 0;
  function buildPalette() {
    pal = document.createElement('div');
    pal.id = 'gtui-pal';
    pal.innerHTML = '<div class="box"><input placeholder="Go to a screen, or type a material name to search the market…" autocomplete="off"><div class="list"></div><div class="ft">↑↓ move · Enter go · Esc close</div></div>';
    document.body.appendChild(pal);
    palIn = pal.querySelector('input');
    palList = pal.querySelector('.list');
    pal.addEventListener('mousedown', (e) => { if (e.target === pal) closePal(); });
    palIn.addEventListener('input', renderPal);
    palIn.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePal();
      else if (e.key === 'ArrowDown') { palSel = Math.min(palSel + 1, palItems.length - 1); paintPal(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { palSel = Math.max(palSel - 1, 0); paintPal(); e.preventDefault(); }
      else if (e.key === 'Enter') { runPal(palSel); e.preventDefault(); }
    });
    palList.addEventListener('click', (e) => { const it = e.target.closest('.it'); if (it) runPal(+it.dataset.i); });
  }
  function renderPal() {
    const q = palIn.value.trim().toLowerCase();
    palItems = Object.entries(LABELS)
      .filter(([, label]) => !q || label.toLowerCase().includes(q))
      .map(([id, label]) => ({ label, hint: 'screen', run: () => { const l = navLink(id); if (l) l.click(); } }));
    if (!q || 'settings theme options hide images'.includes(q)) palItems.push({ label: 'Settings – themes & hide images', hint: 'sleek ui', run: openSettings });
    LINKS.forEach((l) => { if (!q || l.label.toLowerCase().includes(q)) palItems.push({ label: l.label + ' ↗', hint: 'link', run: () => window.open(l.url, '_blank', 'noopener') }); });
    if (q) palItems.push({ label: 'Search market for “' + palIn.value.trim() + '”', hint: 'exchange', run: () => searchMarket(palIn.value.trim()) });
    palSel = q && palItems.length > 1 && !palItems[0].label.toLowerCase().startsWith(q) ? palItems.length - 1 : 0;
    paintPal();
  }
  function paintPal() {
    palList.innerHTML = palItems.map((it, i) =>
      '<div class="it' + (i === palSel ? ' sel' : '') + '" data-i="' + i + '"><span></span><small>' + it.hint + '</small></div>').join('');
    palList.querySelectorAll('.it span').forEach((sp, i) => { sp.textContent = palItems[i].label; });
  }
  function runPal(i) { const it = palItems[i]; closePal(); if (it) it.run(); }
  function openPal() { if (!pal) buildPalette(); palIn.value = ''; renderPal(); pal.classList.add('open'); palIn.focus(); }
  function closePal() { if (pal) pal.classList.remove('open'); }

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPal(); }
    else if (e.key === '/' && !typing) {
      e.preventDefault();
      const f = document.getElementById('nameFilter');
      if (f) f.focus(); else openPal();
    }
  });

  /* ---------- Public API (same host family the game itself uses) ---------- */
  const API_BASES = [];
  if (/galactictycoons\.com$/.test(location.hostname)) API_BASES.push('https://api.' + location.hostname);
  API_BASES.push('https://api.g2.galactictycoons.com');
  let apiBase = null;
  async function apiGet(path) {
    const bases = apiBase ? [apiBase] : [...new Set(API_BASES)];
    let err;
    for (const b of bases) {
      try {
        const r = await fetch(b + path, { credentials: 'omit' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        apiBase = b;
        return j;
      } catch (e) { err = e; }
    }
    throw err;
  }

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
  const money = (c) => (c == null || c < 0 ? '–' : (c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const pct = (v) => (v == null ? '' : (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%');
  const sget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const sset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };

  const mk = {
    prices: new Map(), pricesAt: 0, loading: false, ok: null,
    det: new Map(), sort: sget('gtui:msort', { k: null, desc: false }), range: sget('gtui:mrange', 30),
    listSig: '', infoSig: '', shown: [], hv: null,
  };

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; syncAll(); });
  }

  async function loadPrices() {
    if (mk.loading || Date.now() - mk.pricesAt < 60000) return;
    mk.loading = true;
    try {
      const j = await apiGet('/public/exchange/mat-prices');
      mk.prices = new Map(j.prices.map((p) => [norm(p.matName), p]));
      mk.pricesAt = Date.now();
      mk.ok = true;
    } catch (e) {
      mk.ok = false;
      mk.pricesAt = Date.now() - 50000;   // retry in ~10s
    }
    mk.loading = false;
    mk.listSig = ''; mk.infoSig = '';
    schedule();
  }

  function loadDetails(id) {
    const c = mk.det.get(id);
    if (c && (c.loading || Date.now() - c.at < 60000)) return c;
    const e = c || {};
    e.loading = true; e.at = Date.now();
    mk.det.set(id, e);
    apiGet('/public/exchange/mat-details/' + id)
      .then((j) => { e.data = j; e.err = false; })
      .catch(() => { e.err = true; })
      .finally(() => { e.loading = false; e.at = Date.now(); mk.infoSig = ''; schedule(); });
    return e;
  }

  /* ---------- Market: sortable item list built from the game's own rows + API prices ---------- */
  function syncMarket() {
    const panel = document.getElementById('exchangeMaterialsPanel');
    const row = panel && panel.closest('main > .container-xxl > .row.g-4');
    const tab = panel && panel.querySelector('.card-header .nav-link.active');
    const onMat = !!(panel && row && tab && /material/i.test(tab.textContent));
    let list = document.getElementById('gtui-mlist');
    const body = onMat && panel.querySelector('.card-body');
    const table = body && body.querySelector(':scope > table');
    if (!onMat || !table) {
      if (list) list.remove();
      if (panel) delete panel.dataset.gtuiMl;
      mk.listSig = '';
      return;
    }
    loadPrices();
    if (!list) {
      list = document.createElement('div');
      list.id = 'gtui-mlist';
      list.addEventListener('click', (e) => {
        const hb = e.target.closest('.h button');
        if (hb) {
          const k = hb.dataset.k;
          if (k === '_') mk.sort = { k: null, desc: false };
          else if (mk.sort.k === k) mk.sort = { k, desc: !mk.sort.desc };
          else mk.sort = { k, desc: k === 'delta' || k === 'name' ? false : false };
          sset('gtui:msort', mk.sort); mk.listSig = ''; schedule();
          return;
        }
        const r = e.target.closest('.r');
        const it = r && mk.shown[+r.dataset.i];
        if (it && it.tr.isConnected) it.tr.click();
      });
    }
    if (list.previousElementSibling !== table) table.after(list);
    panel.dataset.gtuiMl = '1';

    const items = [];
    table.querySelectorAll('tbody > tr').forEach((tr, i) => {
      const td = tr.children;
      if (td.length < 3) return;
      const name = td[0].textContent.trim();
      const ic = td[0].querySelector('svg.io');
      const gp = parseFloat(td[2].textContent.replace(/[^0-9.]/g, ''));
      const api = mk.prices.get(norm(name));
      const low = api && api.currentPrice > 0 ? api.currentPrice : (isFinite(gp) ? Math.round(gp * 100) : null);
      const avg = api && api.avgPrice > 0 ? api.avgPrice : null;
      items.push({
        tr, i, name, low, avg,
        delta: low != null && avg ? (low - avg) / avg : null,
        icon: ic ? ic.outerHTML : '',
        fav: !!td[0].querySelector('.icon-indicator1'),
        sell: td[1].textContent.trim(),
        sel: tr.classList.contains('table-active'),
      });
    });
    const { k, desc } = mk.sort;
    if (k) {
      const dir = desc ? -1 : 1;
      items.sort((a, b) => {
        if (k === 'name') return a.name.localeCompare(b.name) * dir;
        const x = a[k], y = b[k];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x - y) * dir;
      });
    }
    const sig = [k, desc, mk.pricesAt, mk.ok, items.map((x) => x.name + x.low + x.sel + x.fav + x.sell).join('|')].join('#');
    if (sig === mk.listSig) return;
    mk.listSig = sig;
    mk.shown = items;
    const hdr = (key, label) => '<button type="button" data-k="' + key + '" class="' + (k === key ? 'on' + (desc ? ' desc' : '') : '') + '">' + label + '</button>';
    list.innerHTML =
      '<div class="h">' + hdr('name', 'Material') + hdr('low', 'Lowest') + hdr('avg', 'Avg') + hdr('delta', 'vs avg') + '</div>' +
      (items.length ? items.map((x, n) =>
        '<div class="r' + (x.sel ? ' sel' : '') + '" data-i="' + n + '"><span class="n">' + x.icon +
        (x.fav ? '<span class="fav">★</span>' : '') + '<span class="t">' + esc(x.name) + '</span>' +
        (x.sell ? '<em>' + esc(x.sell) + '</em>' : '') + '</span>' +
        '<span class="p">' + money(x.low) + '</span><span class="a">' + money(x.avg) + '</span>' +
        '<span class="d ' + (x.delta == null ? '' : x.delta > 0.005 ? 'up' : x.delta < -0.005 ? 'dn' : '') + '">' + pct(x.delta) + '</span></div>').join('')
        : '<div class="none">No materials match.</div>') +
      '<div class="src">' + (mk.ok === false ? 'Live prices unavailable – showing game prices'
        : mk.ok ? 'Prices: public exchange API · refreshed ' + new Date(mk.pricesAt).toLocaleTimeString() : 'Loading prices…') +
      ' · <button type="button" data-k="_" style="all:unset;cursor:pointer;color:var(--ui-accent)">reset order</button></div>';
  }

  /* ---------- Market: info + price-history chart for the selected material ---------- */
  function chartSvg(hist, range) {
    let h = hist.filter((x) => x.avgPrice > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (range) h = h.slice(-range);
    if (h.length < 2) { mk.hv = null; return '<div class="empty">Not enough trade history yet.</div>'; }
    const W = Math.max(320, mk.cw || 640), pt = 10, pb = 40, pl = 0;
    const H = window.innerWidth >= 2300 ? Math.round(Math.min(560, Math.max(260, W * 0.7))) : 190;   // taller chart when it has its own column
    const ps = h.map((x) => x.avgPrice);
    let lo = Math.min(...ps), hi = Math.max(...ps);
    if (hi === lo) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    const qm = Math.max(...h.map((x) => x.qtySold || 0), 1);
    const step = W / (h.length - 1);
    const X = (i) => pl + i * step;
    const Y = (v) => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
    const line = h.map((x, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x.avgPrice).toFixed(1)).join(' ');
    const area = line + ' L' + X(h.length - 1).toFixed(1) + ' ' + (H - pb) + ' L' + X(0).toFixed(1) + ' ' + (H - pb) + ' Z';
    const bw = Math.max(2, step * 0.6);
    const bars = h.map((x, i) => {
      const bh = 32 * ((x.qtySold || 0) / qm);
      return '<rect x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + (H - 3 - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" style="fill:var(--ui-accent)" opacity=".35"/>';
    }).join('');
    const grid = [0, 0.5, 1].map((f) => {
      const v = lo + (hi - lo) * (1 - f);
      const y = pt + (H - pt - pb) * f;
      return '<line x1="0" x2="' + W + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#ffffff" stroke-opacity=".07"/>' +
        '<text x="4" y="' + (y - 3).toFixed(1) + '" fill="#8c91b8" font-size="11">' + money(v) + '</text>';
    }).join('');
    mk.hv = { h, W, H, pt, pb, X, Y };
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + grid +
      '<path d="' + area + '" style="fill:var(--ui-accent)" opacity=".14"/><path d="' + line + '" fill="none" style="stroke:color-mix(in srgb, var(--ui-accent) 65%, #fff)" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
      bars + '<line class="cx" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#fff" stroke-opacity=".35" style="display:none"/>' +
      '<circle class="cd" r="4" fill="#fff" style="display:none"/>' +
      '<text x="4" y="' + (H - pb + 14) + '" fill="#8c91b8" font-size="11">' + h[0].date + '</text>' +
      '<text x="' + (W - 4) + '" y="' + (H - pb + 14) + '" fill="#8c91b8" font-size="11" text-anchor="end">' + h[h.length - 1].date + '</text></svg>' +
      '<div class="tip"></div>';
  }

  function syncInfo() {
    const row = document.querySelector('main > .container-xxl > .row.g-4');
    const trade = document.getElementById('exchangeTradeMatCard');
    let card = document.getElementById('gtui-minfo');
    const nameEl = trade && trade.querySelector('.card-header .h5');
    if (!row || !nameEl) { if (card) card.remove(); mk.infoSig = ''; return; }
    const name = nameEl.textContent.trim();
    const p = mk.prices.get(norm(name));
    const d = p ? loadDetails(p.matId) : null;
    const sig = [name, p && p.currentPrice, d && d.at, d && d.err, mk.range, mk.ok].join('#');
    if (card && card.parentElement === row && sig === mk.infoSig) return;
    if (!card || card.parentElement !== row) {
      if (card) card.remove();
      card = document.createElement('div');
      card.id = 'gtui-minfo';
      row.append(card);
      card.addEventListener('click', (e) => {
        const b = e.target.closest('.rng button');
        if (b) { mk.range = +b.dataset.r; sset('gtui:mrange', mk.range); mk.infoSig = ''; schedule(); }
      });
      card.addEventListener('mousemove', (e) => {
        const ch = e.target.closest('.chart');
        const hv = mk.hv;
        if (!ch || !hv) return;
        const svg = ch.querySelector('svg'), tip = ch.querySelector('.tip');
        const r = svg.getBoundingClientRect();
        const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const i = Math.round(f * (hv.h.length - 1));
        const pt = hv.h[i], x = hv.X(i), y = hv.Y(pt.avgPrice);
        const cx = svg.querySelector('.cx'), cd = svg.querySelector('.cd');
        cx.setAttribute('x1', x); cx.setAttribute('x2', x); cx.style.display = '';
        cd.setAttribute('cx', x); cd.setAttribute('cy', y); cd.style.display = '';
        tip.style.display = 'block';
        tip.style.left = (x / hv.W * r.width) + 'px';
        tip.textContent = pt.date + ' · ' + money(pt.avgPrice) + '$ · ' + (pt.qtySold || 0).toLocaleString() + ' sold';
      });
      card.addEventListener('mouseleave', () => {
        card.querySelectorAll('.cx,.cd').forEach((n) => { n.style.display = 'none'; });
        const t = card.querySelector('.tip'); if (t) t.style.display = 'none';
      });
    }
    mk.infoSig = sig;
    const ic = trade.querySelector('svg.io');
    const data = d && d.data;
    const cur = p ? p.currentPrice : null, avg = p && p.avgPrice > 0 ? p.avgPrice : null;
    const delta = cur > 0 && avg ? (cur - avg) / avg : null;
    const hist = (data && data.priceHistory) || [];
    let ch7 = null;
    if (hist.length > 7) { const a = hist[hist.length - 1].avgPrice, b = hist[hist.length - 8].avgPrice; if (a > 0 && b > 0) ch7 = (a - b) / b; }
    const orders = (data && data.orders) || [];
    const second = orders.length > 1 ? orders[1].unitPrice : null;
    const stat = (l, v) => '<div class="stat"><span>' + l + '</span><b>' + v + '</b></div>';
    // the public API keeps ~30 days of history, so only offer ranges that actually differ
    const days = hist.filter((x) => x.avgPrice > 0).length;
    const ranges = [7, 14, 30, 90].filter((r) => r < days);
    const curRange = mk.range && ranges.includes(mk.range) ? mk.range : 0;
    const rb = (r, l) => '<button type="button" data-r="' + r + '" class="' + (curRange === r ? 'on' : '') + '">' + l + '</button>';
    card.innerHTML =
      '<div class="top">' + (ic ? ic.outerHTML : '') + '<div><div class="nm">' + esc(name) + '</div><div class="sub">' +
      (data ? orders.length.toLocaleString() + ' offers · ' + (data.totalQtyAvailable || 0).toLocaleString() + ' units' : p ? 'loading…' : 'no market data') +
      '</div></div><div class="big"><b>' + money(cur) + '$</b>' + (delta != null ? '<span class="chip ' + (delta > 0.005 ? 'up' : delta < -0.005 ? 'dn' : '') + '">' + pct(delta) + ' vs avg</span>' : '') +
      '<div class="sub">lowest offer</div></div></div>' +
      '<div class="stats">' + stat('Avg trade price', money(avg) + '$') +
      stat('7-day change', ch7 == null ? '–' : '<span class="' + (ch7 > 0 ? 'up' : 'dn') + '">' + pct(ch7) + '</span>') +
      stat('Sold per day', data && data.avgQtySoldDaily != null ? Math.round(data.avgQtySoldDaily).toLocaleString() : '–') +
      stat('Next offer', second != null ? money(second) + '$' : '–') + '</div>' +
      '<div class="rng">' + ranges.map((r) => rb(r, r + 'd')).join('') + rb(0, days ? 'All (' + days + 'd)' : 'All') + '</div>' +
      '<div class="chart"></div>';
    const holder = card.querySelector('.chart');
    mk.cw = Math.round(holder.clientWidth) || 640;
    holder.innerHTML = data ? chartSvg(hist, curRange) : d && d.err ? '<div class="empty">Price history unavailable.</div>' : '<div class="empty">Loading history…</div>';
  }
  window.addEventListener('resize', () => { mk.infoSig = ''; schedule(); });

  /* ---------- Sidebar: profile stats scraped from the game's own profile modal ---------- */
  let prof = sget('gtui:prof2', null);
  let profTried = 0, profBusy = false;
  /* stats are only ever read right after YOU open your own profile from the menu in the sidebar */
  let ownOpenAt = 0;
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('#app > nav.navbar .dropdown-menu > li.dropdown-item[translate="no"]')) ownOpenAt = Date.now();
  }, true);
  function parseProfile() {
    const m = document.querySelector('.modal.show');
    if (!m || Date.now() - ownOpenAt > 8000) return false;
    /* only ever read OUR OWN profile, never another company's */
    const me = document.querySelector('#app > nav.navbar .dropdown-menu > li.dropdown-item[translate="no"]');
    const myName = me ? me.textContent.trim() : '';
    if (!myName || (m.querySelector('.modal-title') || {}).textContent !== myName) return false;
    const out = {};
    m.querySelectorAll('.caption-small').forEach((c) => {
      const label = c.textContent.trim().toLowerCase();
      if (!['rank', 'prestige', 'value'].includes(label)) return;
      const v = (c.parentElement.textContent || '').replace(c.textContent, '').replace('#', '').trim();
      if (v) out[label] = v;
    });
    if (out.prestige && out.value) { prof = Object.assign({}, prof, out, { at: Date.now(), name: myName }); sset('gtui:prof2', prof); renderStats(); return true; }
    return false;
  }
  function renderStats() {
    const bar = document.querySelector('#app > nav.navbar > .container-xxl');
    const grp = bar && bar.querySelector('.btn-group');
    let box = document.getElementById('gtui-stats2');
    if (!bar || !grp) return;
    const meEl = document.querySelector('#app > nav.navbar .dropdown-menu > li.dropdown-item[translate="no"]');
    /* numbers saved by older versions (or for another company) are never shown */
    if (!prof || !meEl || prof.name !== meEl.textContent.trim()) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.id = 'gtui-stats2'; }
    if (box.previousElementSibling !== grp) grp.after(box);
    const html = (prof.prestige ? '<div title="Prestige"><span>Prestige</span><b>' + esc(prof.prestige) + '</b></div>' : '') +
      (prof.value ? '<div title="Company value"><span>Value</span><b>' + esc(prof.value) + '</b></div>' : '');
    if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; }
  }
  async function refreshProfile() {
    if (profBusy || document.querySelector('.modal.show')) return;
    const item = document.querySelector('#app > nav.navbar .dropdown-menu > li.dropdown-item[translate="no"]');
    if (!item) return;
    profBusy = true; profTried = Date.now();
    root.classList.add('gtui-silent');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      item.click();
      for (let i = 0; i < 30 && !parseProfile(); i++) await wait(100);
      const close = document.querySelector('.modal.show .btn-close');
      if (close) close.click();
      await wait(500);
    } finally { root.classList.remove('gtui-silent'); profBusy = false; }
  }

  /* ---------- Settings: themes, accent, hide images, UI size ---------- */
  const THEMES = {
    nebula:   { name: 'Nebula',   bg: '#07081a', panel: '#0d0f26', p2: '#131637', border: '#25264d', fg: '#d4d9ff', dim: '#8c91b8', accent: '#7c5cff' },
    ocean:    { name: 'Ocean',    bg: '#050f1a', panel: '#09182a', p2: '#0f2540', border: '#1d3d63', fg: '#d6e8ff', dim: '#84a3c6', accent: '#38a9f8' },
    emerald:  { name: 'Emerald',  bg: '#05110d', panel: '#09201a', p2: '#0f2e25', border: '#1d4d3d', fg: '#d4f5e6', dim: '#84b9a2', accent: '#2fc995' },
    ember:    { name: 'Ember',    bg: '#130905', panel: '#1f110a', p2: '#2c1910', border: '#4d2e1c', fg: '#ffe6d4', dim: '#c4a28a', accent: '#f2873a' },
    crimson:  { name: 'Crimson',  bg: '#13060a', panel: '#200b12', p2: '#2e101b', border: '#4d1f2e', fg: '#ffdce3', dim: '#c48a99', accent: '#ec3f62' },
    graphite: { name: 'Graphite', bg: '#0c0c0e', panel: '#151517', p2: '#1e1e22', border: '#33333a', fg: '#e6e6ea', dim: '#9b9ba6', accent: '#6f86ff' },
    terminal: { name: 'Terminal', bg: '#020502', panel: '#061006', p2: '#0c1c0c', border: '#1d3f1d', fg: '#c9f7c9', dim: '#7fae7f', accent: '#3ddc3d' },
    midnight: { name: 'Midnight', bg: '#000000', panel: '#08080d', p2: '#101018', border: '#24243a', fg: '#e2e2f0', dim: '#8888a4', accent: '#a78bfa' },
  };
  const CFG_DEFAULT = { theme: 'nebula', accent: '', hideAvatars: false, hideLogos: false, hidePortraits: false, size: '', side: 'left', quick: 'row', showLinks: true, showStats: true, showPills: true, translate: false, tlang: 'en', outlang: 'es', chanMode: 'full', blocked: [], saved: [], showKeys: true, chatMax: '', chatSide: 'left', hideContacts: false };
  let cfg = Object.assign({}, CFG_DEFAULT, sget('gtui:cfg', {}));
  const hexRgb = (h) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || ''); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [124, 92, 255]; };
  const CUSTOM_KEYS = [['bg', 'Page background'], ['panel', 'Panels'], ['p2', 'Raised panels / hover'], ['border', 'Borders'], ['fg', 'Text'], ['dim', 'Dim text'], ['accent', 'Accent']];
  const HEX = /^#[0-9a-f]{6}$/i;
  const themeOf = () => cfg.theme === 'custom' ? Object.assign({}, THEMES.nebula, cfg.custom || {}) : (THEMES[cfg.theme] || THEMES.nebula);
  function applyCfg() {
    const t = themeOf();
    let accent = cfg.accent || t.accent;
    let [r, g, b] = hexRgb(accent);
    let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (lum < 0.2 && cfg.theme !== 'custom') { accent = t.accent; [r, g, b] = hexRgb(accent); lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; }   /* near-black accent is invisible on dark themes */
    const st = root.style;
    st.setProperty('--ui-bg', t.bg); st.setProperty('--ui-panel', t.panel); st.setProperty('--ui-panel-2', t.p2);
    st.setProperty('--ui-border', t.border); st.setProperty('--ui-fg', t.fg); st.setProperty('--ui-dim', t.dim);
    st.setProperty('--ui-accent', accent); st.setProperty('--ui-accent-rgb', r + ', ' + g + ', ' + b);
    st.setProperty('--ui-accent-fg', lum > 0.62 ? '#0b0b12' : '#fff');
    const [br, bg2, bb] = hexRgb(t.bg);
    st.setProperty('--ui-hi', (0.299 * br + 0.587 * bg2 + 0.114 * bb) / 255 > 0.5 ? '#000' : '#fff');   // emphasised text: white on dark themes, black on light ones
    root.classList.toggle('gtui-hide-avatars', !!cfg.hideAvatars);
    root.classList.toggle('gtui-hide-logos', !!cfg.hideLogos);
    root.classList.toggle('gtui-hide-portraits', !!cfg.hidePortraits);
    root.classList.toggle('gtui-right', cfg.side === 'right');
    root.classList.toggle('gtui-qstack', cfg.quick === 'stack');
    root.classList.toggle('gtui-hide-links', !cfg.showLinks);
    root.classList.toggle('gtui-hide-stats', !cfg.showStats);
    root.classList.toggle('gtui-hide-pills', !cfg.showPills);
    root.classList.toggle('gtui-hide-keys', !cfg.showKeys);
    root.classList.toggle('gtui-chat-right', cfg.chatSide === 'right');
    root.classList.toggle('gtui-hide-contacts', !!cfg.hideContacts);
    root.classList.toggle('gtui-chan-compact', cfg.chanMode === 'compact');
    if (cfg.chatMax) st.setProperty('--gtui-chatmax', cfg.chatMax + 'px'); else st.removeProperty('--gtui-chatmax');
    if (cfg.size) st.setProperty('font-size', cfg.size + 'px', 'important'); else st.removeProperty('font-size');
    mk.infoSig = ''; 
  }
  function saveCfg() { sset("gtui:cfg", cfg); applyCfg(); schedule(); }

  let setPanel = null;
  function renderSettings() {
    const t = themeOf();
    const chk = (k, label) => '<label class="chk"><input type="checkbox" data-k="' + k + '"' + (cfg[k] ? ' checked' : '') + '> ' + label + '</label>';
    setPanel.innerHTML =
      '<div class="hd"><b>Sleek UI</b><button type="button" class="x" data-a="close" title="Close">✕</button></div>' +
      '<div class="sec">Theme</div><div class="themes">' +
      Object.entries(THEMES).map(([k, v]) => '<button type="button" class="th' + (cfg.theme === k ? ' on' : '') + '" data-t="' + k + '" style="--a:' + v.accent + ';--b:' + v.panel + '"><i></i>' + v.name + '</button>').join('') +
      '<button type="button" class="th' + (cfg.theme === 'custom' ? ' on' : '') + '" data-t="custom" style="grid-column:1/-1;--a:' + (cfg.custom && cfg.custom.accent || t.accent) + ';--b:' + (cfg.custom && cfg.custom.panel || t.panel) + '"><i></i>Custom theme…</button>' +
      '</div>' +
      (cfg.theme === 'custom'
        ? '<div class="cust">' + CUSTOM_KEYS.map(([k, l]) => '<label class="rw"><span>' + l + '</span><input type="color" data-c="' + k + '" value="' + t[k] + '"></label>').join('') +
          '<div class="crow"><button type="button" class="sm" data-a="c-save">Save as…</button><button type="button" class="sm" data-a="c-copy">Copy code</button><button type="button" class="sm" data-a="c-import">Paste code</button></div>' +
          '<div class="blist">' + ((cfg.saved || []).length ? cfg.saved.map((x, i) => '<span class="bchip"><button type="button" data-a="c-load" data-i="' + i + '" style="color:var(--ui-fg)" title="Use this theme">' + esc(x.name) + '</button><button type="button" data-a="c-del" data-i="' + i + '" title="Delete">✕</button></span>').join('') : '<span class="note" style="margin:0">No saved themes yet.</span>') + '</div>' +
          '<div class="crow"><button type="button" class="sm" data-a="c-export">Export all to file</button><button type="button" class="sm" data-a="c-importfile">Import file</button><input type="file" accept=".json,application/json" data-f="themes" hidden></div></div>'
        : '<label class="rw"><span>Accent colour</span><span><input type="color" data-a="accent" value="' + (cfg.accent || t.accent) + '"> <button type="button" class="sm" data-a="accent-reset">reset</button></span></label>') +
      '<div class="sec">Hide images</div>' +
      chk('hideAvatars', 'Chat avatars') + chk('hideLogos', 'Company logos (lists, offers, profiles)') + chk('hidePortraits', 'Player portraits') +
      '<div class="sec">Sidebar layout</div>' +
      '<label class="rw"><span>Side of the screen</span><select data-k="side">' +
      [['left', 'Left'], ['right', 'Right']].map(([v, l]) => '<option value="' + v + '"' + (cfg.side === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<label class="rw"><span>Notes / alerts / profile</span><select data-k="quick">' +
      [['row', 'In a row'], ['stack', 'Stacked']].map(([v, l]) => '<option value="' + v + '"' + (cfg.quick === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      chk('showLinks', 'Show links') + chk('showStats', 'Show prestige / value') + chk('showPills', 'Show resource pills') + chk('showKeys', 'Show shortcuts hint (sidebar)') +
      '<div class="sec">Comms</div>' +
      '<label class="rw"><span>Channels &amp; contacts</span><select data-k="chatSide">' +
      [['left', 'Left of chat'], ['right', 'Right of chat']].map(([v, l]) => '<option value="' + v + '"' + (cfg.chatSide === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<label class="rw"><span>Channels column</span><select data-k="chanMode">' +
      [['full', 'Full'], ['compact', 'Compact (icons, expands on hover)']].map(([v, l]) => '<option value="' + v + '"' + (cfg.chanMode === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<label class="rw"><span>Max chat width</span><select data-k="chatMax">' +
      [['', 'No limit'], ['800', 'Narrow (800px)'], ['1000', 'Medium (1000px)'], ['1300', 'Wide (1300px)'], ['1700', 'Extra wide (1700px)']].map(([v, l]) => '<option value="' + v + '"' + (String(cfg.chatMax) === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      chk('hideContacts', 'Hide the contacts list') +
      '<div class="sec">Blocked players</div>' +
      '<div class="blk"><input type="text" data-b="in" placeholder="Company name (without the [TAG])" maxlength="60"><button type="button" class="sm" data-a="b-add">Block</button></div>' +
      '<div class="blist">' + ((cfg.blocked || []).length ? cfg.blocked.map((n) => '<span class="bchip">' + esc(n) + '<button type="button" data-a="b-del" data-n="' + esc(n) + '" title="Unblock">✕</button></span>').join('') : '<span class="note" style="margin:0">Nobody blocked. Tip: Alt+click a name in chat to block it.</span>') + '</div>' +
      chk('translate', 'Auto-translate chat messages') +
      '<label class="rw"><span>Translate incoming into</span><select data-k="tlang">' + langOpts(cfg.tlang, true) + '</select></label>' +
      '<label class="rw"><span>My messages go out in</span><select data-k="outlang">' + langOpts(cfg.outlang) + '</select></label>' +
      '<div class="note">Tip: end a message with a tag like <b>:fr</b> or <b>:de</b> and it is translated when you press Enter.</div>' +
      '<div class="note">Translation sends message text to Google Translate (Chrome 138+ translates on-device instead). Off by default.</div>' +
      '<div class="sec">Interface</div>' +
      '<label class="rw"><span>UI size</span><select data-k="size">' +
      [['', 'Auto (by screen)'], ['14', 'Small'], ['16', 'Normal'], ['18', 'Large'], ['20', 'Extra large'], ['22', 'Huge']].map(([v, l]) => '<option value="' + v + '"' + (String(cfg.size) === v ? ' selected' : '') + '>' + l + '</option>').join('') +
      '</select></label>' +
      '<div class="note">Settings are saved in this browser. <button type="button" class="sm" data-a="reset-all">Reset all</button></div>';
  }
  function addBlock(raw) {
    const n = String(raw || '').replace(/^\s*\[[^\]]*\]\s*/, '').trim();   // ignore a leading [TAG]
    if (!n) return;
    cfg.blocked = cfg.blocked || [];
    if (!cfg.blocked.some((x) => x.toLowerCase() === n.toLowerCase())) { cfg.blocked.push(n); saveCfg(); }
  }
  function buildSettings() {
    setPanel = document.createElement('div');
    setPanel.id = 'gtui-set';
    document.body.appendChild(setPanel);
    setPanel.addEventListener('click', (e) => {
      const th = e.target.closest('[data-t]');
      if (th) {
        if (th.dataset.t === 'custom' && !cfg.custom) { const b = themeOf(); cfg.custom = { bg: b.bg, panel: b.panel, p2: b.p2, border: b.border, fg: b.fg, dim: b.dim, accent: cfg.accent && HEX.test(cfg.accent) ? cfg.accent : b.accent }; }
        cfg.theme = th.dataset.t; cfg.accent = ''; saveCfg(); renderSettings(); return;
      }
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'close') closeSettings();
      else if (a.dataset.a === 'c-save') {
        const name = (window.prompt('Name for this theme:') || '').trim().slice(0, 40);
        if (name) { cfg.saved = (cfg.saved || []).filter((x) => x.name.toLowerCase() !== name.toLowerCase()); const cur = Object.assign({}, themeOf(), cfg.custom || {}); const c = {}; CUSTOM_KEYS.forEach(([k]) => { c[k] = cur[k]; }); cfg.saved.push({ name, c }); saveCfg(); renderSettings(); }
      } else if (a.dataset.a === 'c-load') {
        const x = (cfg.saved || [])[+a.dataset.i]; if (x) { cfg.custom = Object.assign({}, x.c); cfg.theme = 'custom'; saveCfg(); renderSettings(); }
      } else if (a.dataset.a === 'c-del') { cfg.saved.splice(+a.dataset.i, 1); saveCfg(); renderSettings(); }
      else if (a.dataset.a === 'c-export') {
        const list = (cfg.saved || []).slice();
        if (cfg.custom && !list.length) list.push({ name: 'My theme', c: cfg.custom });
        const url = URL.createObjectURL(new Blob([JSON.stringify({ gtui: 1, themes: list }, null, 2)], { type: 'application/json' }));
        const dl = document.createElement('a'); dl.href = url; dl.download = 'gt-sleek-ui-themes.json'; document.body.appendChild(dl); dl.click(); dl.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else if (a.dataset.a === 'c-importfile') { const f = setPanel.querySelector('[data-f="themes"]'); if (f) f.click(); }
      else if (a.dataset.a === 'c-copy') {
        const code = 'gtui1:' + btoa(JSON.stringify(cfg.custom || {}));
        (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => { a.textContent = 'Copied!'; }, () => { window.prompt('Copy this theme code:', code); });
        setTimeout(() => { a.textContent = 'Copy theme code'; }, 1500);
      } else if (a.dataset.a === 'c-import') {
        const raw = (window.prompt('Paste a theme code (starts with gtui1:)') || '').trim();
        try {
          const o = JSON.parse(atob(raw.replace(/^gtui1:/, '')));
          const c = {}; CUSTOM_KEYS.forEach(([k]) => { if (HEX.test(o[k])) c[k] = o[k]; });
          if (Object.keys(c).length) { cfg.custom = Object.assign({}, themeOf(), c); cfg.theme = 'custom'; saveCfg(); renderSettings(); }
        } catch (err) { window.alert('That does not look like a theme code.'); }
      }
      else if (a.dataset.a === 'b-add') { addBlock((setPanel.querySelector('[data-b="in"]') || {}).value); renderSettings(); }
      else if (a.dataset.a === 'b-del') { cfg.blocked = (cfg.blocked || []).filter((n) => n !== a.dataset.n); saveCfg(); renderSettings(); }
      else if (a.dataset.a === 'accent-reset') { cfg.accent = ''; saveCfg(); renderSettings(); }
      else if (a.dataset.a === 'reset-all') { cfg = Object.assign({}, CFG_DEFAULT); saveCfg(); renderSettings(); }
    });
    setPanel.addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.c) { cfg.custom = Object.assign({}, cfg.custom || themeOf(), { [el.dataset.c]: el.value }); saveCfg(); return; }
      if (el.dataset.a === 'accent') { cfg.accent = el.value; saveCfg(); return; }
      if (el.dataset.k) {
        cfg[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
        saveCfg();
      }
    });
    setPanel.addEventListener('change', (e) => {
      const f = e.target;
      if (!f.dataset || f.dataset.f !== 'themes' || !f.files || !f.files[0]) return;
      f.files[0].text().then((txt) => {
        const o = JSON.parse(txt); let n = 0;
        (o.themes || []).forEach((t) => {
          const c = {}; CUSTOM_KEYS.forEach(([k]) => { if (t && t.c && HEX.test(t.c[k])) c[k] = t.c[k]; });
          if (t && t.name && Object.keys(c).length) { const name = String(t.name).slice(0, 40); cfg.saved = (cfg.saved || []).filter((x) => x.name.toLowerCase() !== name.toLowerCase()); cfg.saved.push({ name, c: Object.assign({}, THEMES.nebula, c) }); n++; }
        });
        if (!n) throw new Error('none');
        saveCfg(); renderSettings();
      }).catch(() => window.alert('Could not read any themes from that file.'));
    });
    setPanel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.dataset && e.target.dataset.b === 'in') { addBlock(e.target.value); renderSettings(); }
    });
    document.addEventListener('mousedown', (e) => {
      if (setPanel.classList.contains('open') && !setPanel.contains(e.target) && !e.target.closest('#gtui-setbtn')) closeSettings();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && setPanel.classList.contains('open')) closeSettings(); });
  }
  function openSettings() { if (!setPanel) buildSettings(); renderSettings(); setPanel.classList.add('open'); }
  function closeSettings() { if (setPanel) setPanel.classList.remove('open'); }
  function toggleSettings() { if (setPanel && setPanel.classList.contains('open')) closeSettings(); else openSettings(); }

  /* ---------- Sidebar: external links ---------- */
  const LINKS = [
    { label: 'GT Companion', short: 'GC', url: 'https://gt-companion.com/' },
    { label: 'TiT Race', short: 'TR', url: 'https://race.titguild.com/' },
    { label: 'Exchange Enquirer', short: 'EE', url: 'https://lloir.github.io/exchange-enquirer-pages/index.html' },
  ];
  function ensureLinks() {
    const menu = document.querySelector('#app > nav.navbar .navbar-menu');
    let box = document.getElementById('gtui-links');
    if (!menu) return;
    if (!box) {
      box = document.createElement('div');
      box.id = 'gtui-links';
      box.innerHTML = '<div class="hd">Links</div>' + LINKS.map((l) =>
        '<a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(l.label) + '"><i>' + esc(l.short) + '</i><span>' + esc(l.label) + '</span></a>').join('');
    }
    if (menu.nextElementSibling !== box) menu.after(box);
  }

  /* ---------- Sidebar: Notes quick button (opens the game's own Notes item) ---------- */
  function ensureNotes() {
    const bar = document.querySelector('#app > nav.navbar > .container-xxl');
    if (!bar) return;
    const old = document.getElementById('gtui-notes'); if (old) old.remove();   // earlier versions put it in the bottom row
    const menu = bar.querySelector('.navbar-menu');
    const dd = bar.querySelector('.dropdown-menu');
    if (!menu || !dd) return;
    let a = document.getElementById('gtui-notes-nav');
    if (!a) {
      a = document.createElement('a');
      a.id = 'gtui-notes-nav'; a.className = 'nav-link'; a.setAttribute('data-gtui-label', 'Notes'); a.title = 'Notes'; a.setAttribute('role', 'button');
      const anyUse = bar.querySelector('svg use');
      const base = anyUse ? (anyUse.getAttribute('xlink:href') || anyUse.getAttribute('href') || '').split('#')[0] : '';
      a.innerHTML = '<svg class="iu"><use xlink:href="' + base + '#notebook"></use></svg>';
      a.addEventListener('click', () => {
        const item = [...document.querySelectorAll('#app > nav.navbar .dropdown-menu > li.dropdown-item')].find((li) => /notes/i.test(li.textContent));
        if (item) item.click();
      });
    }
    if (a.parentElement !== menu) menu.appendChild(a);
    /* newer game versions ship their own Notes icon in the top bar: we already have Notes in the nav list, so hide the stray duplicate */
    bar.querySelectorAll(':scope > span, :scope > button').forEach((el) => {
      if (el.id === 'gtui-notes-nav' || el.hasAttribute('data-popup-id')) return;
      const u = el.querySelector('svg use');
      const ref = (u && (u.getAttribute('xlink:href') || u.getAttribute('href'))) || '';
      if (ref.endsWith('#notebook') && !el.classList.contains('gtui-dupe')) el.classList.add('gtui-dupe');
    });
  }

  /* ---------- Research: jump bar + expand/collapse all ---------- */
  let rsSig = '';
  function syncResearch() {
    const cards = [...document.querySelectorAll('main .card-collapsible[id^="researchItem"]')];
    let bar = document.getElementById('gtui-rs');
    if (!cards.length) { if (bar) bar.remove(); rsSig = ''; return; }
    if (!bar || bar.parentElement !== cards[0].parentElement) {
      if (bar) bar.remove();
      bar = document.createElement('div'); bar.id = 'gtui-rs';
      cards[0].parentElement.insertBefore(bar, cards[0]);
      rsSig = '';
      bar.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const all = [...document.querySelectorAll('main .card-collapsible[id^="researchItem"]')];
        const open = (c, want) => { if (c.classList.contains('show') !== want) c.querySelector(':scope > .card-header').click(); };
        if (b.dataset.all) { all.forEach((c) => open(c, b.dataset.all === 'open')); return; }
        const c = document.getElementById(b.dataset.id); if (!c) return;
        open(c, true);
        setTimeout(() => c.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      });
    }
    const sig = cards.map((c) => c.id + (c.querySelector('.badge') || {}).textContent).join('|');
    if (sig === rsSig) return;
    rsSig = sig;
    bar.innerHTML = cards.map((c) => {
      const h = c.querySelector(':scope > .card-header'); const ic = h && h.querySelector('svg.iu');
      const name = h && h.querySelector('span:not(.badge)'); const lv = h && h.querySelector('.badge');
      const n = lv ? (lv.textContent.match(/\d+/) || ['0'])[0] : '0';
      return '<button type="button" data-id="' + c.id + '"' + (+n > 0 ? ' class="has"' : '') + '>' + (ic ? ic.outerHTML : '') + (name ? name.textContent : '') + '<em>' + n + '</em></button>';
    }).join('') + '<span class="sp"></span><button type="button" class="ctl" data-all="open">Expand all</button><button type="button" class="ctl" data-all="close">Collapse all</button>';
  }

  /* ---------- Wingdings <-> text ---------- */
  const WD_UP = Array.from('✌👌👍👎☜☞☝☟🖐☺😐☹💣☠🏳🏱✈☼💧❄🕆✞🕈✠✡☪');
  const WD_LO = Array.from('♋♌♍♎♏♐♑♒♓🙰🙵●🔾■□🞐❑❒⬧⧫◆❖⬥⌧⍓⌘');
  const WD_DI = Array.from('📁📂📄🗏🗐🗄⌛🖮🖰🖲');
  const WD_DEC = new Map(), WD_ENC = new Map();
  [[WD_UP, 65], [WD_LO, 97], [WD_DI, 48]].forEach(([arr, base]) => arr.forEach((ch, i) => { const c = String.fromCharCode(base + i); WD_DEC.set(ch, c); WD_ENC.set(c, ch); }));
  function fromWing(text) {
    const chars = Array.from(text.replace(/[\uFE0E\uFE0F]/g, '')).filter((c) => !/\s/.test(c));
    const hits = chars.filter((c) => WD_DEC.has(c)).length;
    if (hits < 3 || hits < chars.length * 0.6) return null;
    return Array.from(text.replace(/[\uFE0E\uFE0F]/g, '')).map((c) => WD_DEC.get(c) || c).join('');
  }
  const toWing = (text) => Array.from(text).map((c) => WD_ENC.get(c) || c).join('');

  /* ---------- Chat auto-translate (opt-in) ---------- */
  const LANGS = [['en','English'],['cy','Welsh'],['es','Spanish'],['de','German'],['fr','French'],['pt','Portuguese'],['ru','Russian'],['zh-CN','Chinese (Simplified)'],['zh-TW','Chinese (Traditional)'],['ja','Japanese'],['ko','Korean'],['pl','Polish'],['it','Italian'],['nl','Dutch'],['tr','Turkish'],['uk','Ukrainian'],['cs','Czech'],['sv','Swedish'],['da','Danish'],['no','Norwegian'],['fi','Finnish'],['el','Greek'],['hu','Hungarian'],['ro','Romanian'],['bg','Bulgarian'],['hr','Croatian'],['sr','Serbian'],['sk','Slovak'],['sl','Slovenian'],['lt','Lithuanian'],['lv','Latvian'],['et','Estonian'],['ga','Irish'],['gd','Scottish Gaelic'],['is','Icelandic'],['ca','Catalan'],['eu','Basque'],['gl','Galician'],['af','Afrikaans'],['sq','Albanian'],['ar','Arabic'],['he','Hebrew'],['fa','Persian'],['hi','Hindi'],['bn','Bengali'],['ur','Urdu'],['ta','Tamil'],['th','Thai'],['vi','Vietnamese'],['id','Indonesian'],['ms','Malay'],['tl','Filipino'],['sw','Swahili'],['be','Belarusian'],['kk','Kazakh'],['ka','Georgian'],['hy','Armenian'],['mn','Mongolian'],['la','Latin'],['wd','Wingdings (symbols)']];
  const langOpts = (cur, noWd) => LANGS.filter(([v]) => !(noWd && v === 'wd')).map(([v, l]) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + l + '</option>').join('');
  const tr = { cache: new Map(), queue: [], busy: 0, pending: new Set(), det: null };
  function sim(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    if (a === b) return 1;
    const m = a.length, n = b.length; if (!m || !n) return 0;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return 1 - prev[n] / Math.max(m, n);
  }
  /* Glagolitic (Old Church Slavonic script) -> Cyrillic, so the translation service can read it */
  const GLAG_MAP = ['а','б','в','г','д','е','ж','ѕ','з','и','и','и','ђ','к','л','м','н','о','п','р','с','т','у','ф','х','о','п','щ','ц','ч','ш','ъ','ы','е','х','ю','я','я','е','я','у','ю','ф','и','ь','а','м'];
  const hasGlag = (t) => /[\u2C00-\u2C5F]/.test(t);
  const glagToCyr = (t) => t.replace(/[\u2C00-\u2C5F]/g, (c) => { const i = c.charCodeAt(0) - (c.charCodeAt(0) < 0x2C30 ? 0x2C00 : 0x2C30); return GLAG_MAP[i] || c; });
  async function translateText(text, tl) {
    if (hasGlag(text)) text = glagToCyr(text);
    const base = tl.split('-')[0];
    try {   // Chrome's on-device translator, when present
      if ('Translator' in self && 'LanguageDetector' in self) {
        tr.det = tr.det || await LanguageDetector.create();
        const r = (await tr.det.detect(text))[0];
        if (r && r.confidence > 0.6) {
          if (r.detectedLanguage === base) return null;
          if ((await Translator.availability({ sourceLanguage: r.detectedLanguage, targetLanguage: base })) === 'available') {
            const t = await Translator.create({ sourceLanguage: r.detectedLanguage, targetLanguage: base });
            return { text: await t.translate(text), src: r.detectedLanguage };
          }
        }
      }
    } catch (e) { /* fall through to the web service */ }
    const res = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=' + encodeURIComponent(tl) + '&q=' + encodeURIComponent(text));
    if (!res.ok) throw new Error('translate ' + res.status);
    const d = await res.json();
    const out = (d[0] || []).map((x) => x[0]).join('');
    const src = d[2] || '';
    if (!out || src.split('-')[0] === base || out.trim().toLowerCase() === text.trim().toLowerCase()) return null;
    if (sim(out, text) > (text.length < 8 ? 0.5 : 0.6)) return null;   /* typos / slang that the service 'corrects' are not foreign language */
    return { text: out, src };
  }
  const EN_WORDS = new Set('the a an and or but is are was were be been am i you he she it we they me my your his her its our their this that these those to of in on at for with from by as not no yes do does did have has had will would can could should just so if then than too very really what who when where why how all any some more most one lol im dont cant its thats ok okay hello hi hey thanks thank please got get go going gonna want need sell buy price new good bad also about out up down over now still even only there here been much many well yeah nope'.split(' '));
  function looksEnglish(text) {
    const w = text.toLowerCase().match(/[a-z']+/g) || [];
    if (w.length < 2) return false;
    const hit = w.filter((x) => EN_WORDS.has(x)).length;
    return hit / w.length >= 0.3;
  }
  const base0 = (c) => c.split('-')[0];
  function trShow(el, r) {
    if (!r || !el.isConnected) return;
    let n = el.querySelector(':scope > .gtui-tr');
    if (!n) { n = document.createElement('div'); n.className = 'gtui-tr'; el.appendChild(n); }
    n.dataset.l = r.src; n.textContent = r.text;
  }
  async function trPump() {
    while (tr.busy < 3 && tr.queue.length) {
      const job = tr.queue.shift(); tr.busy++;
      (async () => {
        try {
          const r = await translateText(job.text, cfg.tlang || 'en');
          tr.cache.set(job.key, r); trShow(job.el, r);
        } catch (e) { tr.pending.delete(job.key); (tr.failed = tr.failed || {})[job.key] = Date.now(); if (!tr.warned) { tr.warned = 1; console.warn('[gtui] translate failed', e); } }
        finally { tr.busy--; trPump(); }
      })();
    }
  }
  function syncTranslate() {
    if (!cfg.translate) return;
    const tl = cfg.tlang || 'en';
    const meEl = document.querySelector('#app > nav.navbar .dropdown-menu > li.dropdown-item[translate="no"]');
    const myName = meEl ? meEl.textContent.trim() : '';
    const msgs = [...document.querySelectorAll('main .com-msg')].slice(-80);
    for (const el of msgs) {
      const who = el.closest('.com-group'); const hb = who && who.querySelector('.com-header b');
      if (myName && hb && hb.textContent.trim() === myName) continue;   /* never translate our own lines */
      const clone = el.cloneNode(true); const old = clone.querySelector('.gtui-tr'); if (old) old.remove();
      const text = clone.textContent.trim();
      const wd0 = fromWing(text); if (wd0) { trShow(el, { text: wd0, src: 'Wingdings' }); continue; }
      const latin = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]*$/u.test(text);   // Thai / Cyrillic / CJK words can be short and still real
      if (text.length > 600 || !/\p{L}/u.test(text) || (latin ? !/\p{L}{3}/u.test(text) : text.length < 2)) continue;
      if (base0(tl) === 'en' && looksEnglish(text)) continue;   /* obviously English: no need to ask the service */
      const key = tl + '|' + text;
      if (tr.cache.has(key)) { trShow(el, tr.cache.get(key)); continue; }
      if (tr.pending.has(key)) continue;
      if (tr.failed && tr.failed[key] && Date.now() - tr.failed[key] < 30000) continue;
      tr.pending.add(key);
      tr.queue.push({ el, text, key });
    }
    trPump();
  }

  /* ---------- Chat: translate what you type (button above the message box) ---------- */
  async function webTranslate(text, tl, sl) {
    const res = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + (sl || 'auto') + '&dt=t&tl=' + encodeURIComponent(tl) + '&q=' + encodeURIComponent(text));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    return (d[0] || []).map((x) => x[0]).join('');
  }
  /* "hello there :fr"  ->  on send, the message is translated and the tag dropped */
  let tagBusy = false;
  const TAG_RE = /\s+:([a-z]{2,3}(?:-[a-z]{2})?)\s*$/i;
  function tagLang(text) {
    const m = TAG_RE.exec(text); if (!m) return null;
    let c = m[1].toLowerCase(); if (c === 'zh') c = 'zh-CN';
    const hit = LANGS.find(([v]) => v.toLowerCase() === c);
    return hit ? { code: hit[0], text: text.slice(0, m.index).trim() } : null;
  }
  async function sendTagged(ta, tag, resend) {
    tagBusy = true;
    try {
      const r = tag.code === 'wd' ? toWing(tag.text) : (tag.text ? await webTranslate(tag.text, tag.code, 'auto') : '');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, r || tag.text);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (err) {
      console.warn('[gtui] translate failed', err);
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, tag.text);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    resend();
    setTimeout(() => { tagBusy = false; }, 50);
  }
  document.addEventListener('keydown', (e) => {
    const ta = e.target;
    if (tagBusy || !cfg.translate || e.key !== 'Enter' || e.shiftKey || !ta || ta.tagName !== 'TEXTAREA' || !ta.closest('main .card-footer')) return;
    const tag = tagLang(ta.value); if (!tag) return;
    e.preventDefault(); e.stopImmediatePropagation();
    sendTagged(ta, tag, () => ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })));
  }, true);
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('main .card-footer button');
    if (tagBusy || !b || !cfg.translate || b.closest('#gtui-out')) return;
    const ta = b.closest('.card-footer').querySelector('textarea'); if (!ta) return;
    const tag = tagLang(ta.value); if (!tag) return;
    e.preventDefault(); e.stopImmediatePropagation();
    sendTagged(ta, tag, () => b.click());
  }, true);

  function syncOutbound() {
    const ta = document.querySelector('main .card-footer textarea');
    let bar = document.getElementById('gtui-out');
    if (!ta || !cfg.translate) { if (bar) bar.remove(); return; }
    const foot = ta.closest('.card-footer');
    if (!bar || foot.previousElementSibling !== bar) {
      if (bar) bar.remove();
      bar = document.createElement('div'); bar.id = 'gtui-out';
      foot.before(bar);
      bar.addEventListener('change', (e) => { if (e.target.matches('select')) { cfg.outlang = e.target.value; saveCfg(); } });
      bar.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const t = document.querySelector('main .card-footer textarea');
        const text = t.value.trim(); if (!text) return;
        b.disabled = true; const old = b.textContent; b.textContent = '…';
        try {
          const r = cfg.outlang === 'wd' ? toWing(text) : await webTranslate(text, cfg.outlang || 'es', 'auto');
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, r);
          t.dispatchEvent(new Event('input', { bubbles: true })); t.focus();
        } catch (err) { console.warn('[gtui] translate failed', err); b.textContent = 'failed'; setTimeout(() => { b.textContent = old; }, 1500); }
        b.disabled = false; if (b.textContent === '…') b.textContent = old;
      });
    }
    const sig = cfg.outlang;
    if (bar.dataset.sig !== sig) { bar.dataset.sig = sig; bar.innerHTML = '<b class="ic">文A</b><span class="l">Translate my message to</span><select>' + langOpts(sig) + '</select><button type="button">Translate</button><span class="tip">or end a message with <b>:' + (sig || 'es').toLowerCase() + '</b></span>'; }
  }

  /* ---------- Chat: blocked players ---------- */
  document.addEventListener('click', (e) => {   // Alt+click a name in chat to block that company
    if (!e.altKey) return;
    const b = e.target.closest && e.target.closest('main .com-header b');
    if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const n = b.textContent.trim();
    if (n && window.confirm('Block ' + n + '? You will not see their chat messages. (Undo in Sleek UI settings.)')) { addBlock(n); syncBlocked(); }
  }, true);
  function syncBlocked() {
    const set = new Set((cfg.blocked || []).map((n) => n.toLowerCase()));
    document.querySelectorAll('main .com-group').forEach((g) => {
      const b = g.querySelector('.com-header b');
      const hide = !!b && set.has(b.textContent.trim().toLowerCase());
      if (g.classList.contains('gtui-blocked') !== hide) g.classList.toggle('gtui-blocked', hide);
    });
  }

  function ensureKeys() {
    const bar = document.querySelector('#app > nav.navbar > .container-xxl');
    if (!bar || document.getElementById('gtui-keys')) return;
    const d = document.createElement('div');
    d.id = 'gtui-keys';
    d.innerHTML = '<div class="hd">Shortcuts</div>' +
      '<div class="r"><span>Jump to screen</span><span><kbd>Ctrl</kbd> <kbd>K</kbd></span></div>' +
      '<div class="r"><span>Collapse sidebar</span><kbd>[</kbd></div>' +
      '<div class="r"><span>Close panels</span><kbd>Esc</kbd></div>' +
      '<div class="r"><span>Block a player</span><span><kbd>Alt</kbd>+click name</span></div>' +
      '<div class="r"><span>Translate a message</span><kbd>:fr</kbd></div>';
    bar.appendChild(d);
  }

  function syncCompactBits() {
    document.querySelectorAll('main .row.h-100 > .col-3 .list-group-item[translate="no"]').forEach((b) => {
      const t = (b.textContent || '').trim();
      const ini = Array.from(t.replace(/^\W+/, '')).slice(0, 2).join('');
      if (b.dataset.gtuiI !== ini) b.dataset.gtuiI = ini;
    });
    document.querySelectorAll('#app > nav.navbar .btn-group > .btn').forEach((b) => {
      const t = (b.textContent || '').trim();
      let short = t;
      const m = /^([\d,]+)$/.exec(t);
      if (m) {
        const n = parseInt(m[1].replace(/,/g, ''), 10);
        short = n >= 1e9 ? (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : t;
      }
      if (b.dataset.gtuiS !== short) b.dataset.gtuiS = short;
      if (b.title !== t && /^[\d,]+$/.test(t)) b.title = t;
    });
  }

  function syncAll() {
    ensureKeys();
    syncCompactBits();
    syncBlocked();
    ensureLinks(); ensureNotes(); ensureToggle(); labelNav(); syncCats(); syncXchToggle();
    syncMarket(); syncInfo(); syncResearch(); syncTranslate(); syncOutbound();
    if (document.querySelector('.modal.show')) parseProfile();
    renderStats();
    /* no more auto-opening the profile modal: stats refresh whenever you open your own profile yourself */
  }

  injectCss();
  applyCfg();
  applyCollapsed(store.get());

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key === '[' && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) {
      applyCollapsed(!root.classList.contains('gtui-collapsed'));
    }
  });

  // Vue mounts after load and may re-render; keep our bits alive and our CSS last.
  const mo = new MutationObserver(() => {
    schedule();
    const css = document.getElementById('gtui-css');
    if (css && css.nextElementSibling) (document.head || root).appendChild(css);
  });
  const start = () => {
    mo.observe(document.body || root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    schedule();
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
