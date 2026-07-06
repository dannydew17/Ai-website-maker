const MIN_INTERVAL_MS = 2000;
const lastRequestByDomain = new Map<string, number>();

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enforces a minimum spacing between requests to the same domain. Simple
 * in-memory per-process throttle — adequate for a single sequential worker
 * (see the plan's build-order notes on scaling to a real queue later).
 */
export async function waitForDomainSlot(hostname: string): Promise<void> {
  const last = lastRequestByDomain.get(hostname) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < MIN_INTERVAL_MS) {
    await sleep(MIN_INTERVAL_MS - elapsed);
  }
  lastRequestByDomain.set(hostname, Date.now());
}
