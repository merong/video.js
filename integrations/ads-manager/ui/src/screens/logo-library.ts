import { useCallback, useEffect, useState } from 'react';

import { type LogoItem, type LogoLibrary, logos, SAMPLE_LOGO_ID } from '../api/logos';
import { describeError, IDLE, type Notice } from '../app/status';
import { useWorkspace } from '../app/workspace-context';
import type { PlayerPreset } from '../player';

export interface LogoLibraryState {
  /** `null` until the first load, and on a host without the library actions. */
  library: LogoLibrary | null;
  status: Notice;
  reload: () => void;
  /** Takes the list an upload or delete returned, so the library does not load again. */
  replace: (library: LogoLibrary) => void;
}

/** The logo library, loaded once while `active`; an older API without `capabilities.logos` loads nothing. */
export function useLogoLibrary(active: boolean): LogoLibraryState {
  const { api, session } = useWorkspace();
  const supported = session.capabilities.logos === true;
  const [library, setLibrary] = useState<LogoLibrary | null>(null);
  const [status, setStatus] = useState<Notice>(IDLE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active || !supported) return;

    let current = true;

    logos(api).then(
      (value) => {
        if (!current) return;

        setLibrary(value);
        setStatus(IDLE);
      },
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- receives whatever a failed request threw.
      (error: unknown) => {
        if (current) setStatus(describeError(error).message);
      }
    );

    return () => {
      current = false;
    };
  }, [api, active, supported, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const replace = useCallback((value: LogoLibrary) => {
    setLibrary(value);
    setStatus(IDLE);
  }, []);

  return { library, status, reload, replace };
}

export function findLogo(library: LogoLibrary | null, logoId: string): LogoItem | null {
  return library?.items.find((item) => item.logoId === logoId) ?? null;
}

export interface PreviewLogo {
  /** The preset the preview frame's parser accepts: the sample logo or none, and no `logo.url`. */
  preset: PlayerPreset;
  /** The image the frame draws instead (`preview.logo`), or `null` for the sample or no logo. */
  logoSrc: string | null;
}

/**
 * The preview frame parses presets with the site player's `preset.js`, which knows only the sample logo for now
 * (contract R1 3, 4). An uploaded logo or an image address goes to the frame as `preview.logo` instead.
 */
export function previewLogo(preset: PlayerPreset, library: LogoLibrary | null): PreviewLogo {
  const { url, ...logo } = preset.logo;
  const sample = logo.assetId === SAMPLE_LOGO_ID;
  const uploaded = logo.assetId !== null && !sample ? findLogo(library, logo.assetId) : null;
  const logoSrc = url ?? uploaded?.url ?? null;

  if (!url && (logo.assetId === null || sample)) return { preset, logoSrc: null };

  return { preset: { ...preset, logo: { ...logo, assetId: null } }, logoSrc };
}
