import { normalizeTimeoutSeconds } from '../utils.js';

export default async function handleExtractText({ automation, execution, step }) {
  const { xpath = '', timeout: timeoutSeconds = 5, as = null } = step.config ?? {};
  const locator = automation.page.locator(`xpath=${xpath}`).first();
  const timeout = normalizeTimeoutSeconds(timeoutSeconds, 5) * 1000;
  await locator.waitFor({ state: 'attached', timeout });
  const text = (await locator.textContent())?.trim() ?? '';
  if (as) {
    execution.setVar(as, text);
  }
  return text;
}
