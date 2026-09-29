type ClockSample = { receivedAt: number; latency: number; offset: number };

export function createRoomClock(now = () => performance.now()) {
  let samples: ClockSample[] = [];
  return {
    reset() { samples = []; },
    sample(startedAt: number, receivedAt: number, serverReceivedAt: number, serverSentAt: number) {
      if (![startedAt, receivedAt, serverReceivedAt, serverSentAt].every(Number.isFinite)) return false;
      const processing = serverSentAt - serverReceivedAt;
      const latency = receivedAt - startedAt - processing;
      if (processing < 0 || latency < -10 || latency > 2000) return false;
      samples = samples.filter(sample => receivedAt - sample.receivedAt < 60000).slice(-4);
      samples.push({
        receivedAt, latency: Math.max(0, latency),
        offset: (serverReceivedAt + serverSentAt - startedAt - receivedAt) / 2,
      });
      return true;
    },
    now(): number | null {
      if (!samples.length) return null;
      // Prefer the least delayed recent exchange, excluding server queue/Redis time.
      const best = samples.reduce((a, b) => a.latency < b.latency ? a : b);
      return now() + best.offset;
    },
  };
}
