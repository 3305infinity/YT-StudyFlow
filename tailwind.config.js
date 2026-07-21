/** @type {import('tailwindcss').Config} */

/**
 * YT StudyFlow — Unified Design System
 * ------------------------------------
 * Single visual language for the whole product.
 *
 * Accent: purple -> pink gradient.
 * Gradient is ONLY allowed on: logo, active tab indicator, primary CTA,
 * progress bars, selected states. Never on cards / page backgrounds /
 * chat bubbles / note backgrounds.
 *
 * Dark-first. Near-black charcoal background, layered surfaces,
 * semantic status colors. No random backgrounds.
 */

const BRAND_FROM = '#a855f7'; // purple-500
const BRAND_VIA = '#c026d3'; // fuchsia-600
const BRAND_TO = '#ec4899'; // pink-500

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ---- Brand accent (single identity) ----
        brand: {
          DEFAULT: BRAND_FROM,
          from: BRAND_FROM,
          via: BRAND_VIA,
          to: BRAND_TO,
          muted: '#d8b4fe', // purple-300, for subtle text on dark
          contrast: '#ffffff',
        },

        // ---- Surfaces (one dark language) ----
        // base < base, surface (panel), raised (card), overlay (popover)
        base: '#09090b', // zinc-950-ish, not pure black
        surface: {
          DEFAULT: '#101013', // panel background (slightly lighter than base)
          raised: '#161619', // card / elevated surface
          overlay: '#1c1c20', // popovers, tooltips, hover
        },

        // ---- Text ----
        content: {
          DEFAULT: '#f4f4f5', // zinc-100, primary text
          muted: '#a1a1aa', // zinc-400, secondary text
          subtle: '#71717a', // zinc-500, captions / labels
          faint: '#52525b', // zinc-600, disabled / hint (use sparingly)
        },

        // ---- Border ----
        line: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong: 'rgba(255,255,255,0.14)',
          soft: 'rgba(255,255,255,0.05)',
        },

        // ---- Status (semantic, unified) ----
        success: {
          DEFAULT: '#34d399', // emerald-400
          soft: 'rgba(52,211,153,0.12)',
          border: 'rgba(52,211,153,0.30)',
        },
        warning: {
          DEFAULT: '#fbbf24', // amber-400
          soft: 'rgba(251,191,36,0.12)',
          border: 'rgba(251,191,36,0.30)',
        },
        danger: {
          DEFAULT: '#f87171', // red-400
          soft: 'rgba(248,113,113,0.12)',
          border: 'rgba(248,113,113,0.30)',
        },
        info: {
          DEFAULT: '#a855f7',
          soft: 'rgba(168,85,247,0.12)',
          border: 'rgba(168,85,247,0.30)',
        },
      },

      // ---- Typography scale (one font: Inter Variable) ----
      fontFamily: {
        sans: [
          'Inter',
          'Inter Variable',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // display, heading, subheading, body, caption, tiny label
        display: ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '700' }],
        heading: ['1.125rem', { lineHeight: '1.35', letterSpacing: '-0.01em', fontWeight: '600' }],
        subheading: ['1rem', { lineHeight: '1.45', letterSpacing: '-0.005em', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }],
        label: ['0.6875rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.02em' }],
        micro: ['0.625rem', { lineHeight: '1.3', fontWeight: '500', letterSpacing: '0.04em' }],
      },

      // ---- Spacing scale (4,8,12,16,20,24,32,40,48) ----
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
      },

      // ---- Radius scale ----
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        full: '9999px',
      },

      // ---- Shadow / elevation ----
      boxShadow: {
        // level 0 = flat with hairline border
        1: '0 1px 2px rgba(0,0,0,0.4)',
        2: '0 4px 12px rgba(0,0,0,0.45)',
        3: '0 12px 32px rgba(0,0,0,0.5)',
        focus: '0 0 0 2px rgba(168,85,247,0.45)',
        cta: '0 6px 20px rgba(168,85,247,0.35)',
      },

      // ---- Transitions ----
      transitionDuration: {
        DEFAULT: '170ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      // ---- Utilities for the brand gradient (allowed surfaces only) ----
      backgroundImage: {
        'brand-gradient': `linear-gradient(135deg, ${BRAND_FROM} 0%, ${BRAND_VIA} 50%, ${BRAND_TO} 100%)`,
      },

      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
};
