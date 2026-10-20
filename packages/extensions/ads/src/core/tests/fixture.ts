import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';

import type { PlaybackSchedule } from '../playback';

// Read the coordinator-owned wire fixture rather than maintaining a player-specific copy.
export function loadPlaybackFixture(): PlaybackSchedule {
  return JSON.parse(
    readFileSync(
      new NodeURL('../../../../../../integrations/ads-manager/contract/playback-v1.json', import.meta.url),
      'utf8'
    )
  );
}
