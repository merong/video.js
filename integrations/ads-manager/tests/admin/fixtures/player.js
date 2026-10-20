// Contract-only player double. It does not play media or collect events.
export const calls = [];

export function createAdsController(options) {
  const session = { options, destroyed: false };

  calls.push(session);
  return {
    destroy() {
      session.destroyed = true;
    },
  };
}
