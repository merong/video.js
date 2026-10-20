import {
  type PlaybackAd,
  type PlaybackBreak,
  type PlaybackIssue,
  type PlaybackSchedule,
  parsePlaybackSchedule,
  validateScheduleDuration,
} from './playback';

/** A settled content observation; intermediate seek positions must not be sent as progress. @internal */
export interface ContentObservation {
  readonly type: 'play' | 'progress' | 'seek' | 'ended';
  readonly currentTime: number;
  /** Read the media's actual ended state, including on seek-to-end. */
  readonly ended?: boolean;
}

/** Capture this object when starting asynchronous work; stale callbacks cannot advance a newer ad. @internal */
export interface ScheduledAd {
  readonly break: PlaybackBreak;
  readonly ad: PlaybackAd;
  readonly adIndex: number;
}

/** @internal */
export type AdResult = 'complete' | 'skip' | 'error';

/**
 * One content session's scheduling state, with no clocks, media, network, or event transport. Observations reserve
 * breaks; startBreak consumes a reservation. Keeping those separate lets teardown cancel a reservation without
 * pretending a break ran. Reuse this instance across replay/reconnect; create another for a new content session.
 *
 * @internal
 */
export class AdsScheduler {
  readonly schedule: PlaybackSchedule;
  readonly #consumed = new Set<string>();
  #pending: PlaybackBreak[] = [];
  #active: ScheduledAd | null = null;
  #currentTime = 0;
  #issues: readonly PlaybackIssue[] = Object.freeze([]);

  constructor(schedule: PlaybackSchedule) {
    const parsed = parsePlaybackSchedule(schedule);
    if (!parsed.ok) throw new Error(`Invalid ads schedule: ${parsed.issues[0]?.path}`);

    this.schedule = parsed.schedule;
  }

  get active(): ScheduledAd | null {
    return this.#active;
  }

  get pending(): PlaybackBreak | null {
    return this.#pending[0] ?? null;
  }

  get issues(): readonly PlaybackIssue[] {
    return this.#issues;
  }

  isConsumed(breakId: string): boolean {
    return this.#consumed.has(breakId);
  }

  /**
   * A newly known invalid duration disables this snapshot and abandons reservations, so the owner can report the issue
   * and release content. It does not silently clamp/remove cues. The owner cancels any active rendering.
   */
  setDuration(duration: number | null | undefined): readonly PlaybackIssue[] {
    // Transient unknown metadata must not re-enable a snapshot already known to contain invalid cues.
    if (duration == null || !Number.isFinite(duration)) return this.#issues;

    this.#issues = validateScheduleDuration(this.schedule, duration);

    if (this.#issues.length) this.cancel();

    return this.#issues;
  }

  /** Reserve due breaks; a seek reserves only the earliest crossed one, while natural progress preserves cue order. */
  observe(observation: ContentObservation): PlaybackBreak | null {
    const { type, currentTime } = observation;
    if (!Number.isFinite(currentTime) || currentTime < 0) throw new RangeError('Invalid content time.');

    // Content controls are isolated while an ad runs, including replay during postroll.
    if (this.#active) return null;

    const previous = this.#currentTime;

    this.#currentTime = currentTime;

    if (this.#issues.length) return null;

    if (type === 'ended' || observation.ended) {
      this.#pending = [];
      this.#reserve(this.schedule.breaks.filter((item) => item.position === 'post'));

      return this.pending;
    }

    if (type === 'play') {
      // Replay can move content back before a reserved break has started.
      if (currentTime < previous) this.#pending = [];

      const preroll = this.schedule.breaks.find((item) => item.position === 'pre' && !this.isConsumed(item.breakId));

      if (preroll) this.#pending = [preroll, ...this.#pending.filter((item) => item !== preroll)];

      return this.pending;
    }

    // Repeated settled notifications keep an existing reservation rather than selecting another missed break.
    if (currentTime === previous) {
      if (type === 'seek') this.#pending = this.#pending.slice(0, 1);

      return this.pending;
    }

    if (type === 'seek' || currentTime < previous) this.#pending = [];

    if (currentTime > previous) {
      const crossed = this.schedule.breaks.filter(
        (item) =>
          item.position === 'mid' &&
          item.atSeconds > previous &&
          item.atSeconds <= currentTime &&
          !this.#consumed.has(item.breakId)
      );

      this.#reserve(type === 'seek' ? crossed.slice(0, 1) : crossed);
    }

    return this.pending;
  }

  /** Consume the exact reserved break before the owner starts its first ad. */
  startBreak(breakId: string): ScheduledAd | null {
    const pending = this.pending;
    if (this.#active || !pending || pending.breakId !== breakId || this.#issues.length) return null;

    this.#pending.shift();
    this.#consumed.add(breakId);
    this.#active = this.#adAt(pending, 0);

    return this.#active;
  }

  /** Only the current ad advances; skip eligibility is checked against that ad's own elapsed time. */
  finishAd(attempt: ScheduledAd, result: AdResult, elapsedSeconds: number): boolean {
    if (attempt !== this.#active || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return false;

    const ad = attempt.ad;
    if (result === 'skip' && (ad.skipAfterSeconds === null || elapsedSeconds < ad.skipAfterSeconds)) return false;

    if (result === 'complete' && ad.kind === 'image' && elapsedSeconds < ad.displaySeconds) return false;

    this.#active = this.#adAt(attempt.break, attempt.adIndex + 1);

    return true;
  }

  /** Cancel a pod/reservation and its natural-progress backlog, preserving only already consumed history. */
  cancel(): void {
    this.#active = null;
    this.#pending = [];
  }

  #reserve(breaks: readonly PlaybackBreak[]): void {
    for (const item of breaks) {
      if (this.#consumed.has(item.breakId) || this.#pending.some((pending) => pending.breakId === item.breakId))
        continue;

      this.#pending.push(item);
    }
  }

  #adAt(item: PlaybackBreak, index: number): ScheduledAd | null {
    const ad = item.ads[index];
    if (!ad) return null;

    return Object.freeze({ break: item, ad, adIndex: index });
  }
}
