// ==UserScript==
// @name         Galactic Tycoons - Pasteimg previews
// @namespace    https://github.com/Lloir/gt-tampermonkey
// @version      0.1.0
// @description  Show Pasteimg links as inline images in Galactic Tycoons chat.
// @match        https://galactictycoons.com/*
// @match        https://*.galactictycoons.com/*
// @exclude      https://api.*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      pasteimg.com
// @updateURL    https://raw.githubusercontent.com/Lloir/gt-tampermonkey/main/gt-pasteimg.user.js
// @downloadURL  https://raw.githubusercontent.com/Lloir/gt-tampermonkey/main/gt-pasteimg.user.js
// ==/UserScript==

(() => {
  'use strict';

  const MESSAGE_SELECTOR = 'main .com-msg';
  const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
  const MAX_PREVIEWS_PER_MESSAGE = 3;
  const cache = new Map();
  const processed = new WeakMap();
  const waiting = [];
  let active = 0;
  let scanQueued = false;

  const style = document.createElement('style');
  style.textContent = `
    .gt-pasteimg-preview { display: block; width: fit-content; max-width: 100%; margin: 6px 0 4px; }
    .gt-pasteimg-preview img { display: block; max-width: min(420px, 100%); max-height: 320px; width: auto; height: auto; border-radius: 6px; object-fit: contain; cursor: pointer; }
    .gt-pasteimg-preview img:hover { filter: brightness(1.08); }
  `;
  (document.head || document.documentElement).appendChild(style);

  function pageUrl(candidate) {
    try {
      const url = new URL(candidate.replace(/[),.!?;:]+$/, ''));
      if (url.protocol !== 'https:' || !['pasteimg.com', 'www.pasteimg.com'].includes(url.hostname)) return null;
      if (!/^\/image\/[^/]+$/.test(url.pathname)) return null;
      url.hash = '';
      url.search = '';
      return url.href;
    } catch (_) { return null; }
  }

  function imageUrl(html) {
    if (!html || html.length > 2_000_000) return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const value = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (!value) return null;
    try {
      const url = new URL(value, 'https://pasteimg.com');
      if (url.protocol !== 'https:' || !['pasteimg.com', 'www.pasteimg.com'].includes(url.hostname)) return null;
      if (!/^\/(images|content\/images)\//.test(url.pathname)) return null;
      return url.href;
    } catch (_) { return null; }
  }

  function pump() {
    while (active < 3 && waiting.length) {
      const task = waiting.shift();
      active++;
      let finished = false;
      function finish(result) {
        if (finished) return;
        finished = true;
        active--;
        task.resolve(result);
        pump();
      }
      try {
        GM_xmlhttpRequest({
          method: 'GET', url: task.url, timeout: 12000, anonymous: true,
          onload: (response) => finish(response.status === 200 ? imageUrl(response.responseText) : null),
          onerror: () => finish(null),
          ontimeout: () => finish(null),
        });
      } catch (_) { finish(null); }
    }
  }

  function resolveImage(url) {
    if (!cache.has(url)) {
      cache.set(url, new Promise((resolve) => {
        waiting.push({ url, resolve });
        pump();
      }));
    }
    return cache.get(url);
  }

  function messageText(message) {
    const copy = message.cloneNode(true);
    copy.querySelectorAll('.gt-pasteimg-preview, .gtui-tr').forEach((node) => node.remove());
    return copy.textContent || '';
  }

  function urlsIn(message) {
    const found = new Set();
    for (const match of messageText(message).matchAll(URL_PATTERN)) {
      const url = pageUrl(match[0]);
      if (url) found.add(url);
      if (found.size >= MAX_PREVIEWS_PER_MESSAGE) break;
    }
    return [...found];
  }

  function preview(message, page, image) {
    if (!message.isConnected || !image) return;
    const link = document.createElement('a');
    link.className = 'gt-pasteimg-preview';
    link.href = page;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = 'Open image on Pasteimg';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = 'Pasteimg image preview';
    img.addEventListener('error', () => link.remove(), { once: true });
    img.src = image;
    link.appendChild(img);
    message.appendChild(link);
  }

  function start(message) {
    const urls = urlsIn(message);
    const signature = urls.join('\n');
    if (processed.get(message) === signature) return;
    processed.set(message, signature);
    message.querySelectorAll(':scope > .gt-pasteimg-preview').forEach((node) => node.remove());
    for (const url of urls) {
      resolveImage(url).then((image) => {
        if (processed.get(message) === signature) preview(message, url, image);
      });
    }
  }

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        start(entry.target);
      }
    }, { rootMargin: '300px' })
    : null;

  function scan() {
    scanQueued = false;
    document.querySelectorAll(MESSAGE_SELECTOR).forEach((message) => {
      if (observer && !processed.has(message)) observer.observe(message);
      else if (!observer || processed.has(message)) start(message);
    });
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }

  new MutationObserver(queueScan).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  queueScan();
})();
