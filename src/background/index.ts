/// <reference lib="webworker" />

/**
 * Background service worker — proxies backend API calls and runs the page-context
 * transcript fetch / caption toggle in the YouTube tab.
 *
 * AI requests go through the Express backend (never direct Gemini from the extension).
 * Every proxied URL is checked against an allowlist so the worker can never be used
 * as an open fetch relay.
 */

import { apiOrigin } from '../lib/config/api.config';

/** youtube.com, www.youtube.com, and *.youtube.com / *.googlevideo.com caption hosts. */
const PAGE_FETCH_HOST_RE = /^([a-z0-9-]+\.)*(youtube\.com|googlevideo\.com)$/;

function isSameExtension(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}

function isBackendUrl(raw: string): boolean {
  const origin = apiOrigin();
  if (!origin) return false;
  try {
    return new URL(raw).origin === origin;
  } catch {
    return false;
  }
}

function isPageFetchUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    return PAGE_FETCH_HOST_RE.test(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isSameExtension(sender)) return false;

  if (message?.type === 'YT_STUDYFLOW_API_REQUEST') {
    const url = String(message.url ?? '');

    if (!isBackendUrl(url)) {
      sendResponse({ ok: false, status: 0, text: '', error: 'Blocked URL' });
      return true;
    }

    const method = String(message.method ?? 'GET');
    const headers = (message.headers ?? {}) as Record<string, string>;
    const body = message.body as string | undefined;

    void fetch(url, { method, headers, body })
      .then(async (resp) => {
        sendResponse({
          ok: resp.ok,
          status: resp.status,
          text: await resp.text(),
        });
      })
      .catch((err) => {
        sendResponse({
          ok: false,
          status: 0,
          text: '',
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return true;
  }

  return false;
});

type PageFetchResult = {
  ok: boolean;
  status: number;
  text: string;
  contentType: string;
  error?: string;
};

function pageFetchInMainWorld(
  url: string,
  method: string,
  body: string | null,
  headers: Record<string, string>
): PageFetchResult {
  try {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.open(method, url, false);
    xhr.timeout = 12000;

    if (body) {
      xhr.setRequestHeader('Content-Type', 'application/json');
    }
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.send(body);

    return {
      ok: xhr.status >= 200 && xhr.status < 300,
      status: xhr.status,
      text: xhr.responseText ?? '',
      contentType: xhr.getResponseHeader('content-type') ?? '',
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      text: '',
      contentType: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function enableCaptionsInMainWorld(): boolean {
  const btn =
    document.querySelector('.ytp-subtitles-button[aria-pressed="false"]') ??
    document.querySelector('.ytp-subtitles-button');

  if (btn instanceof HTMLElement) {
    btn.click();
    return true;
  }

  const player = (window as { ytplayer?: { config?: { args?: { cc_load_policy?: number } } } })
    .ytplayer;
  if (player?.config?.args) {
    player.config.args.cc_load_policy = 1;
  }

  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isSameExtension(sender)) return false;

  const tabId = sender.tab?.id;
  if (!tabId) return false;

  if (message?.type === 'YT_STUDYFLOW_PAGE_FETCH') {
    const url = String(message.url ?? '');

    if (!isPageFetchUrl(url)) {
      sendResponse({
        ok: false,
        status: 0,
        text: '',
        contentType: '',
        error: 'Blocked URL',
      });
      return true;
    }

    chrome.scripting
      .executeScript({
        target: { tabId },
        world: 'MAIN',
        func: pageFetchInMainWorld,
        args: [
          url,
          String(message.method ?? 'GET'),
          message.body ? String(message.body) : null,
          (message.headers ?? {}) as Record<string, string>,
        ],
      })
      .then((results) => {
        sendResponse((results[0]?.result as PageFetchResult) ?? null);
      })
      .catch((err) => {
        sendResponse({
          ok: false,
          status: 0,
          text: '',
          contentType: '',
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return true;
  }

  if (message?.type === 'YT_STUDYFLOW_ENABLE_CC') {
    chrome.scripting
      .executeScript({
        target: { tabId },
        world: 'MAIN',
        func: enableCaptionsInMainWorld,
      })
      .then((results) => {
        sendResponse({ clicked: !!results[0]?.result });
      })
      .catch(() => sendResponse({ clicked: false }));
    return true;
  }

  return false;
});

export {};
