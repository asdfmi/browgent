import { chromium } from 'playwright';

export default class BrowserSession {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async init() {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    return this;
  }

  async evaluateOnPage(code, variables) {
    return this.page.evaluate(({ snip, variables: vars }) => {
      const context = { variables: vars };
      const fn = new Function('context', `
        "use strict";
        return (async () => {
          ${snip}
        })();
      `);
      return fn(context);
    }, { snip: code, variables });
  }

  async screenshot(options) {
    return this.page.screenshot(options);
  }

  async cleanup() {
    if (this.context) {
      try {
        await this.context.close();
      } catch (error) {
        this.logger.warn('Failed to close browser context', error);
      }
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        this.logger.warn('Failed to close browser', error);
      }
    }
    this.browser = null;
    this.context = null;
    this.page = null;
  }
}
