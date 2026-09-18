/**
 * Sidebar injection via Shadow DOM on the YouTube page.
 *
 * Real collapsible drawer:
 * - Expanded: 420px
 * - Collapsed: 56px vertical pill
 * - 300ms width transition
 * - React tree never destroyed
 * - Never uses display:none or visibility:hidden
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Sidebar } from '@/sidebar/Sidebar';
import sidebarStyles from '@/sidebar/sidebar.css?inline';
import contentStyles from './content.css?inline';
import { UI } from '@lib/constants';
import {
  installSidebarKeyboardIsolation,
  removeSidebarKeyboardIsolation,
} from './keyboardIsolation';

const HOST_ID = 'yt-studyflow-host';
const ROOT_ID = 'yt-studyflow-root';

let reactRoot: ReactDOM.Root | null = null;
let activeVideoId: string | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
let sidebarCollapsed = false;

function getHost(): HTMLElement | null {
  return document.getElementById(HOST_ID);
}

function getOrCreateHost(): HTMLElement {
  let host = document.getElementById(HOST_ID);
  if (host) return host as HTMLElement;

  host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: ${UI.SIDEBAR_WIDTH}px;
    height: 100vh;
    z-index: 2147483646;
    border: none;
    margin: 0;
    padding: 0;
    background: #0b0f19;
    pointer-events: auto;
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
    transition: top 320ms cubic-bezier(0.16, 1, 0.3, 1),
                right 320ms cubic-bezier(0.16, 1, 0.3, 1),
                width 320ms cubic-bezier(0.16, 1, 0.3, 1),
                height 320ms cubic-bezier(0.16, 1, 0.3, 1),
                border-radius 320ms cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1),
                background 320ms cubic-bezier(0.16, 1, 0.3, 1);
  `;

  document.body.appendChild(host);
  installSidebarKeyboardIsolation();
  toggleSuggestedVideosAndExpandPlayer(true);
  return host;
}

function buildShadowRoot(host: HTMLElement): HTMLElement {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

  if (shadow.querySelector(`#${ROOT_ID}`)) {
    return shadow.getElementById(ROOT_ID)!;
  }

  shadow.innerHTML = '';

  const style = document.createElement('style');
  style.textContent = `
    ${contentStyles}
    ${sidebarStyles}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :host {
      all: initial;
      display: block;
      width: 100%;
      height: 100%;
      font-family: Inter, 'Segoe UI', system-ui, sans-serif;
      color: #fff;
      pointer-events: auto;
    }
    #${ROOT_ID} {
      width: 100%;
      height: 100%;
      overflow: hidden;
      pointer-events: auto;
    }
    button, input, textarea, select, a {
      pointer-events: auto;
      cursor: pointer;
    }
    input, textarea, select {
      cursor: text;
    }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 999px; }
  `;
  shadow.appendChild(style);

  const container = document.createElement('div');
  container.id = ROOT_ID;
  container.style.width = '100%';
  container.style.height = '100%';
  shadow.appendChild(container);
  return container;
}

function toggleSuggestedVideosAndExpandPlayer(expanded: boolean): void {
  const app = document.querySelector('ytd-app');
  const secondary = document.querySelector('#secondary') as HTMLElement | null;

  let styleTag = document.getElementById('yt-studyflow-layout-style');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'yt-studyflow-layout-style';
    document.head.appendChild(styleTag);
  }

  if (expanded) {
    if (secondary) {
      secondary.style.display = 'none';
    }
    if (app instanceof HTMLElement) {
      app.style.marginRight = `${UI.SIDEBAR_WIDTH}px`;
      app.style.transition = 'margin-right 320ms cubic-bezier(0.16, 1, 0.3, 1)';
    }

    styleTag.textContent = `
      ytd-app {
        margin-right: ${UI.SIDEBAR_WIDTH}px !important;
      }
      ytd-watch-flexy[flexy] #primary.ytd-watch-flexy,
      ytd-watch-flexy[flexy] #primary-inner.ytd-watch-flexy {
        max-width: 100% !important;
        width: 100% !important;
      }
      ytd-watch-flexy[flexy] #player-container-outer.ytd-watch-flexy,
      ytd-watch-flexy[flexy] #player-container-inner.ytd-watch-flexy,
      ytd-watch-flexy[flexy] #player-container.ytd-watch-flexy,
      ytd-watch-flexy[flexy] #player.ytd-watch-flexy {
        max-width: 100% !important;
        width: 100% !important;
      }
      #secondary {
        display: none !important;
      }
    `;
  } else {
    if (secondary) {
      secondary.style.display = '';
    }
    if (app instanceof HTMLElement) {
      app.style.marginRight = '0';
      app.style.transition = 'margin-right 320ms cubic-bezier(0.16, 1, 0.3, 1)';
    }
    styleTag.textContent = '';
  }

  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 60);
}

export function collapseSidebar(): void {
  const host = getHost();
  if (!host || sidebarCollapsed) return;
  host.style.top = '72px';
  host.style.right = '18px';
  host.style.width = '48px';
  host.style.height = '48px';
  host.style.borderRadius = '24px';
  host.style.background = 'transparent';
  host.style.boxShadow = '0 8px 24px rgba(168, 85, 247, 0.4), 0 4px 12px rgba(0,0,0,0.6)';
  toggleSuggestedVideosAndExpandPlayer(false);
  sidebarCollapsed = true;
}

export function expandSidebar(): void {
  const host = getHost();
  if (!host || !sidebarCollapsed) return;
  host.style.top = '0';
  host.style.right = '0';
  host.style.width = `${UI.SIDEBAR_WIDTH}px`;
  host.style.height = '100vh';
  host.style.borderRadius = '0';
  host.style.background = '#0b0f19';
  host.style.boxShadow = '-8px 0 32px rgba(0, 0, 0, 0.5)';
  toggleSuggestedVideosAndExpandPlayer(true);
  sidebarCollapsed = false;
}

export function toggleSidebar(): void {
  if (sidebarCollapsed) {
    expandSidebar();
  } else {
    collapseSidebar();
  }
}

class SidebarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return React.createElement(
        'div',
        { style: { padding: 16, color: '#fca5a5', fontSize: 13 } },
        React.createElement('strong', null, 'StudyFlow crashed'),
        React.createElement('p', { style: { marginTop: 8 } }, this.state.error.message)
      );
    }
    return this.props.children;
  }
}

export function injectSidebar(videoId: string): void {
  const allHosts = document.querySelectorAll('#yt-studyflow-host');
  if (allHosts.length > 1) {
    allHosts.forEach((h, i) => { if (i > 0) (h as HTMLElement).remove(); });
  }

  const existingHost = getHost();
  const container = buildShadowRoot(existingHost || getOrCreateHost());

  if (!reactRoot) {
    reactRoot = ReactDOM.createRoot(container);
  }

  if (activeVideoId !== videoId) {
    activeVideoId = videoId;
    reactRoot.render(
      React.createElement(SidebarErrorBoundary, null,
        React.createElement(
          'div',
          {
            style: {
              width: '100%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'row',
            },
          },
          React.createElement(
            'div',
            {
              style: {
                width: '100%',
                flexShrink: 0,
                height: '100%',
              },
            },
            React.createElement(Sidebar, { videoId })
          )
        )
      )
    );
  }

  if (!escHandler) {
    escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        collapseSidebar();
      }
    };
    window.addEventListener('keydown', escHandler);
  }
}

export function removeSidebar(): void {
  if (escHandler) {
    window.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  reactRoot?.unmount();
  reactRoot = null;
  activeVideoId = null;
  removeSidebarKeyboardIsolation();
  document.getElementById(HOST_ID)?.remove();
  toggleSuggestedVideosAndExpandPlayer(false);
}
