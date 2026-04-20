# Goal Description

The goal is to convert the 451-suite project into Progressive Web Apps (PWAs). Specifically, the three main applications (`toshin-tracker`, `schedule-manager` [located in `schedule-tracker`], and `calendar-app`) should operate as three distinct PWAs, each having its own installation flow, separate icons, and independent application contexts.

To achieve this, each application needs its own Web App Manifest (`manifest.json`) and we need to register a Service Worker to provide offline capabilities and caching.

## User Review Required

> [!IMPORTANT]
> **Icons:** PWAs require icons (typically 192x192 and 512x512 pixels). Do you have existing image assets you'd like to use for these three apps? If not, I can generate placeholder icons or you can provide them later. Currently, I see some icons like `schedule-tracker.svg`, but standard PWAs need PNGs.

## Open Questions

- **Service Worker Strategy:** Would you like a single shared Service Worker at the root (`/sw.js`) that caches all files for the entire suite, or separate Service Workers for each app? A shared root Service Worker is generally easier to maintain.
- **Cache Strategy:** Do you have specific requirements for offline behavior (e.g., Cache First vs Network First)? If not, I will use a standard "Stale-While-Revalidate" or "Cache First for static assets, Network First for HTML" approach.

## Proposed Changes

### 1. PWA Manifests

Create a separate `manifest.json` for each app in its respective folder to ensure they are treated as distinct applications.

#### [NEW] [src/toshin-tracker/manifest.json](file:///c:/Users/user/Documents/Github/451-suite/src/toshin-tracker/manifest.json)
Contains PWA configuration, name "Toshin Tracker", `start_url: "./index.html"`, `display: "standalone"`, and references to its icons.

#### [NEW] [src/schedule-tracker/manifest.json](file:///c:/Users/user/Documents/Github/451-suite/src/schedule-tracker/manifest.json)
Contains PWA configuration, name "Schedule Manager", `start_url: "./index.html"`, `display: "standalone"`, and references to its icons.

#### [NEW] [src/calendar/manifest.json](file:///c:/Users/user/Documents/Github/451-suite/src/calendar/manifest.json)
Contains PWA configuration, name "Calendar App", `start_url: "./index.html"`, `display: "standalone"`, and references to its icons.

---

### 2. Service Worker

Create a Service Worker at the root of `src/` to handle caching for all apps.

#### [NEW] [src/sw.js](file:///c:/Users/user/Documents/Github/451-suite/src/sw.js)
A script that intercepts fetch requests and provides caching to enable offline functionality.

---

### 3. HTML Modifications

Modify the entry points for each app to link the manifest and register the Service Worker.

#### [MODIFY] [src/toshin-tracker/index.html](file:///c:/Users/user/Documents/Github/451-suite/src/toshin-tracker/index.html)
- Add `<link rel="manifest" href="manifest.json">`
- Add `<meta name="theme-color" content="#ffffff">`
- Add an inline `<script>` to register `/sw.js`

#### [MODIFY] [src/schedule-tracker/index.html](file:///c:/Users/user/Documents/Github/451-suite/src/schedule-tracker/index.html)
- Add `<link rel="manifest" href="manifest.json">`
- Add `<meta name="theme-color" content="#ffffff">`
- Add an inline `<script>` to register `/sw.js`

#### [MODIFY] [src/calendar/index.html](file:///c:/Users/user/Documents/Github/451-suite/src/calendar/index.html)
- Add `<link rel="manifest" href="manifest.json">`
- Add `<meta name="theme-color" content="#ffffff">`
- Add an inline `<script>` to register `/sw.js`

## Verification Plan

### Automated Tests
- Run `npm run build` to ensure the new files (`manifest.json` and `sw.js`) are properly copied and minified into the `dist/` folder by the existing build script.
- Serve the `dist/` folder locally using `npm run dev`.

### Manual Verification
- Open each app's URL (e.g., `/toshin-tracker/`, `/schedule-tracker/`, `/calendar/`) in the browser.
- Use Chrome DevTools (Application tab) to verify that:
  1. The Web App Manifest is detected correctly for each distinct app.
  2. The Service Worker registers successfully.
  3. The browser prompts to "Install" the app.
