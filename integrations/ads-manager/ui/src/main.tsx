import '../../../../design/components/fonts.css';
import '../../../../design/tokens.css';
import '../../../../design/components/bundle.css';
import './app/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AdminApi } from './api/client';
import { App } from './app/App';
import { type AdminConfig, publicBase, readConfig } from './app/config';

export type { AdminConfig } from './app/config';

export interface MountedAdsAdmin {
  unmount: () => void;
}

/** Mounts the admin into `element`. Hosts that print `#ads-admin-root` and `#ads-config` are mounted automatically. */
export function mountAdsAdmin(element: Element, config: AdminConfig): MountedAdsAdmin {
  const root = createRoot(element);

  try {
    const api = new AdminApi(config.apiUrl);

    root.render(
      <StrictMode>
        <App api={api} publicBase={publicBase(config.apiUrl)} />
      </StrictMode>
    );
  } catch (error) {
    root.render(<ConfigError error={error} />);
  }

  return { unmount: () => root.unmount() };
}

function ConfigError({ error }: { error: unknown }) {
  return (
    <p className="sa-status is-bad" role="alert">
      {error instanceof Error ? error.message : '관리자 화면을 시작하지 못했어요.'}
    </p>
  );
}

function autoMount(): void {
  const element = document.getElementById('ads-admin-root');
  const configElement = document.getElementById('ads-config');
  if (!element || !configElement) return;

  let config: AdminConfig;

  try {
    config = readConfig(configElement);
  } catch (error) {
    createRoot(element).render(<ConfigError error={error} />);
    return;
  }

  mountAdsAdmin(element, config);
}

autoMount();
