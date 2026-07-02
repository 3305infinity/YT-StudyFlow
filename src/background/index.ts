/// <reference lib="webworker" />

/**
 * Background service worker — page fetch, CC toggle, and periodic sync.
 * AI requests go through the Express backend (never direct Gemini from the extension).
 */

import { CLOUD_SYNC_DISABLED } from '../lib/config/sync.config';

const SYNC_ALARM = 'studyflow-sync';
const SYNC_INTERVAL_MINUTES = 30;

async function triggerBackgroundSync(): Promise<void> {
  try {
    const { runSync } = await import('../lib/sync/engine');
    await runSync();
  } catch (err) {
    console.warn('[YT StudyFlow] background sync failed', err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[YT StudyFlow] Extension installed');
  // TODO: Re-enable periodic cloud sync when CLOUD_SYNC_DISABLED=false.
  if (!CLOUD_SYNC_DISABLED) {
    chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_INTERVAL_MINUTES });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM && !CLOUD_SYNC_DISABLED) {
    void triggerBackgroundSync();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'YT_STUDYFLOW_AUTH_COMPLETE') {
    console.log('[YT StudyFlow] Auth session saved');
    // TODO: Re-enable when CLOUD_SYNC_DISABLED=false.
    if (!CLOUD_SYNC_DISABLED) void triggerBackgroundSync();
    return false;
  }
  if (message?.type === 'YT_STUDYFLOW_RUN_SYNC') {
    if (!CLOUD_SYNC_DISABLED) void triggerBackgroundSync();
    return false;
  }
  if (message?.type === 'YT_STUDYFLOW_OPEN_SIGN_IN') {
    const extId = chrome.runtime.id?.trim() ?? '';
    if (!/^[a-p]{32}$/.test(extId)) {
      sendResponse({
        ok: false,
        error: 'Extension id unavailable. Reload the extension and try again.',
      });
      return true;
    }

    const authWebBase = String(message.authWebUrl ?? 'http://localhost:5174').replace(/\/$/, '');
    const url = `${authWebBase}/sign-in?ext_id=${encodeURIComponent(extId)}&redirect=extension`;

    chrome.windows.create(
      { url, type: 'popup', width: 480, height: 720, focused: true },
      (win) => {
        if (chrome.runtime.lastError || !win?.id) {
          chrome.tabs.create({ url }, (tab) => {
            if (chrome.runtime.lastError || !tab?.id) {
              sendResponse({
                ok: false,
                error: 'Could not open the sign-in window. Allow popups for this extension.',
              });
              return;
            }
            sendResponse({ ok: true });
          });
          return;
        }
        sendResponse({ ok: true });
      }
    );
    return true;
  }
  if (message?.type === 'YT_STUDYFLOW_API_REQUEST') {
    const url = String(message.url ?? '');
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
  if (message?.type === 'YT_STUDYFLOW_PING_AUTH_WEB') {
    const url = String(message.url ?? 'http://localhost:5174').replace(/\/$/, '');
    void fetch(`${url}/`, { method: 'GET' })
      .then((resp) => sendResponse({ ok: resp.ok }))
      .catch(() => sendResponse({ ok: false }));
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

    xhr.setRequestHeader('Content-Type', 'application/json');
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() !== 'content-type') {
        xhr.setRequestHeader(key, value);
      }
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
  const tabId = sender.tab?.id;
  if (!tabId) return false;

  if (message?.type === 'YT_STUDYFLOW_PAGE_FETCH') {
    chrome.scripting
      .executeScript({
        target: { tabId },
        world: 'MAIN',
        func: pageFetchInMainWorld,
        args: [
          String(message.url ?? ''),
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
