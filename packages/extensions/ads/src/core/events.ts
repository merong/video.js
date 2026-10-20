/** @internal */
export type AdEventType = 'start' | 'complete' | 'skip' | 'click' | 'error' | 'cancel';

interface AdEventObservation {
  readonly schemaVersion: 1;
  /** Stable across delivery retries, unique within a site. */
  readonly eventId: string;
  readonly playbackSessionId: string;
  readonly breakAttemptId: string;
  readonly adAttemptId: string;
  readonly breakId: string;
  readonly itemId: string;
  readonly adId: string;
  readonly creativeId: string;
  readonly creativeVersion: number;
  readonly scheduleId: string;
  readonly scheduleVersion: number;
  /** Positive per-ad-attempt sequence, independent of delivery order. */
  readonly sequence: number;
  /** Client observation in UTC ISO format, never the server's received time. */
  readonly occurredAt: string;
  readonly contentTimeSeconds: number;
  readonly adElapsedSeconds: number;
}

/**
 * Observed C0 facts. Site/video/board/category are resolved by the server session, not supplied in an event. `cancel`
 * is operational; it never implies a start or completion. Delivery/collection belongs to the controller/server.
 *
 * @internal
 */
export type ObservedAdEvent = AdEventObservation &
  (
    | { readonly type: 'start' | 'complete' | 'skip' | 'click' | 'cancel' }
    | { readonly type: 'error'; readonly code: string; readonly stage: string }
  );
