import { describe, expect, it } from 'vitest';
import { withoutContentType } from './anchorProvider.ts';

describe('timestamp requests from the browser', () => {
  it('drop Content-Type so the calendar is not asked a CORS pre-check it refuses', () => {
    expect(withoutContentType({ 'Content-Type': 'application/octet-stream', Accept: 'application/vnd.opentimestamps.v1' })).toEqual({
      Accept: 'application/vnd.opentimestamps.v1',
    });
  });
});
