import { createContext, useContext } from 'react';

import type { Session } from '../api/actions';
import type { AdminApi } from '../api/client';
import type { Creative } from '../api/model';
import type { ErrorReport, Notice } from './status';

export type SetStatus = (status: Notice) => void;

export interface RunOptions {
  /** Called after the status shows the error; screens use it for 409 handling. */
  onError?: (report: ErrorReport) => void;
}

export interface Workspace {
  api: AdminApi;
  session: Session;
  /** Public web root of this installation, ending in `/`. */
  publicBase: string;
  creatives: Creative[];
  /** `idle` until a screen that reads the list opens; `error` only while no list has loaded yet. */
  creativesState: 'idle' | 'loading' | 'ready' | 'error';
  /** Reloads the creative list; screens call it inside `run`. */
  reloadCreatives: () => Promise<Creative[]>;
  /**
   * Runs one operation at a time. While it runs the workspace is inert, so at most one write (and one admin token) is
   * in flight. Returns `false` when another operation was already running or the task failed.
   */
  run: (setStatus: SetStatus, task: () => Promise<void>, options?: RunOptions) => Promise<boolean>;
  busy: boolean;
  /** Screens report unsaved input so logout and page unload can warn. */
  setDirty: (key: string, dirty: boolean) => void;
}

export const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('useWorkspace must be used inside the authenticated workspace.');

  return workspace;
}
