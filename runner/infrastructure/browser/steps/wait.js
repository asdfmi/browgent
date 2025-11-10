import { sleep } from '../utils.js';

export default async function handleWait({ step }) {
  const durationMs = Number(step.config?.durationMs ?? 1000);
  const ms = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 1000;
  await sleep(ms);
  return false;
}
