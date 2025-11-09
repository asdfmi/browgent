import { sleep } from '../utils.js';

export default async function handleWait({ step }) {
  if (!step.success) {
    await sleep(1000);
  }
  return false;
}
