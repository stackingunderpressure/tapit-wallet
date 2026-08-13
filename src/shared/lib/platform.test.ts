import { describe, it, expect, afterEach, vi } from 'vitest';
import { isIosPwaStandalone } from './platform.ts';

// The one fact this fix depends on: getting this detection right decides
// whether QrScanModal even attempts getUserMedia. A false negative sends
// an iPhone-in-standalone-mode operator straight back into the unreliable
// permission dance (2026-08-13 bug report: "not getting proper permission
// ... turns red in top of iPhone"); a false positive would wrongly deny a
// regular Safari-tab operator the live camera preview.

function mockUserAgent(ua: string) {
  vi.stubGlobal('navigator', { ...navigator, userAgent: ua });
}

function mockStandaloneDisplayMode(matches: boolean) {
  vi.stubGlobal('window', {
    ...window,
    matchMedia: (query: string) => ({
      matches: query === '(display-mode: standalone)' ? matches : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0';

describe('isIosPwaStandalone', () => {
  it('is true on iPhone with display-mode: standalone', () => {
    mockUserAgent(IPHONE_UA);
    mockStandaloneDisplayMode(true);
    expect(isIosPwaStandalone()).toBe(true);
  });

  it('is false on iPhone in a regular Safari tab (not standalone)', () => {
    mockUserAgent(IPHONE_UA);
    mockStandaloneDisplayMode(false);
    expect(isIosPwaStandalone()).toBe(false);
  });

  it('is false on Android even when display-mode reports standalone', () => {
    mockUserAgent(ANDROID_UA);
    mockStandaloneDisplayMode(true);
    expect(isIosPwaStandalone()).toBe(false);
  });

  it('respects the legacy navigator.standalone flag on iOS Safari', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: IPHONE_UA, standalone: true });
    mockStandaloneDisplayMode(false);
    expect(isIosPwaStandalone()).toBe(true);
  });
});
