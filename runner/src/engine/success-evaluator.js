import { normalizeTimeoutSeconds, sleep } from './utils.js';

export default class SuccessEvaluator {
  constructor({ browserSession, execution }) {
    this.browserSession = browserSession;
    this.execution = execution;
  }

  async waitFor(success) {
    if (!success) return;
    const timeoutSeconds = normalizeTimeoutSeconds(success.timeout);
    const deadline = Date.now() + timeoutSeconds * 1000;
    for (;;) {
      const ok = await this.#evaluateCondition(success.condition);
      if (ok) return;
      if (Date.now() > deadline) {
        throw new Error('success condition timed out');
      }
      await sleep(200);
    }
  }

  async evaluate(condition) {
    return this.#evaluateCondition(condition);
  }

  async #evaluateCondition(condition) {
    if (!condition) return true;
    const page = this.browserSession.page;
    if (condition.visible?.xpath) {
      return page.locator(`xpath=${condition.visible.xpath}`).first().isVisible();
    }
    if (condition.exists?.xpath) {
      const count = await page.locator(`xpath=${condition.exists.xpath}`).count();
      return count > 0;
    }
    if (typeof condition.urlIncludes === 'string') {
      const url = page.url();
      return url.includes(condition.urlIncludes);
    }
    if (typeof condition.delay === 'number') {
      await sleep(condition.delay * 1000);
      return true;
    }
    if (condition.script?.code) {
      const variables = this.execution.getVariablesSnapshot();
      const result = await this.browserSession.evaluateOnPage(condition.script.code, variables);
      return Boolean(await result);
    }
    throw new Error(`unsupported success condition: ${JSON.stringify(condition)}`);
  }
}
