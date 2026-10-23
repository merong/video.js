// 16px line icons (design README: stroke 1.5, round caps, currentColor), one per menu route id.
const PATHS = {
  dashboard: (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </>
  ),
  campaigns: <path d="M3.5 14V2.5M3.5 3h8l-1.5 3 1.5 3h-8" />,
  creatives: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2.5 11.5l3.5-3.5 2.5 2.5 2-2 3 3" />
      <circle cx="10.5" cy="6" r="1" />
    </>
  ),
  requests: (
    <>
      <path d="M2.5 9.5l1.6-5.2a1 1 0 0 1 1-.8h5.8a1 1 0 0 1 1 .8l1.6 5.2V12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
      <path d="M2.5 9.5h3l1 1.5h3l1-1.5h3" />
    </>
  ),
  schedule: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3M5 9h2M9 9h2M5 11h2" />
    </>
  ),
  players: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M6.5 6v4l3.5-2z" />
    </>
  ),
  lms: <path d="M8 4.5c-1.5-1-3.5-1.2-5.5-1v9c2-.2 4 0 5.5 1 1.5-1 3.5-1.2 5.5-1v-9c-2-.2-4 0-5.5 1zM8 4.5v9" />,
  approvals: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M5.5 8l1.8 1.8L10.5 6.5" />
    </>
  ),
  reports: <path d="M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5" />,
  settings: (
    <>
      <path d="M2.5 4.5h11M2.5 11.5h11" />
      <circle cx="10.5" cy="4.5" r="1.5" />
      <circle cx="5.5" cy="11.5" r="1.5" />
    </>
  ),
};

// The GnuBoard menu reuses the standalone pictures for the same kind of screen.
const ALIASES = new Map([
  ['house', 'creatives'],
  ['stats', 'reports'],
]);
const ICONS = new Map(Object.entries(PATHS));

export function NavIcon({ id }: { id: string }) {
  const paths = ICONS.get(ALIASES.get(id) ?? id);
  if (!paths) return null;

  return (
    <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
      {paths}
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </svg>
  );
}
