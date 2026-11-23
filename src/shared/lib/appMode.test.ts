import { describe, expect, it } from 'vitest';
import { isApplePhone, isInstalledApp, isPhoneOrTablet } from './appMode.ts';

const mm = (matches: boolean) => () => ({ matches });

describe('appMode', () => {
  it('detects an installed app on iPhone and elsewhere', () => {
    expect(isInstalledApp({ navigator: { standalone: true }, matchMedia: mm(false) })).toBe(true);
    expect(isInstalledApp({ navigator: {}, matchMedia: mm(true) })).toBe(true);
    expect(isInstalledApp({ navigator: {}, matchMedia: mm(false) })).toBe(false);
    expect(isInstalledApp({})).toBe(false);
  });
  it('tells phones from computers', () => {
    const iphone = { navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)' } };
    const mac = { navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)' } };
    expect(isPhoneOrTablet(iphone)).toBe(true);
    expect(isApplePhone(iphone)).toBe(true);
    expect(isPhoneOrTablet(mac)).toBe(false);
    expect(isPhoneOrTablet({ navigator: { userAgent: 'Linux; Android 14' } })).toBe(true);
  });
});
