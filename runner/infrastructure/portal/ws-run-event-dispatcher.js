export default class RunEventDispatcher {
  constructor({ runId, postEvent, logger = console, screenshotIntervalMs = 200 } = {}) {
    this.runId = runId;
    this.postEvent = postEvent;
    this.logger = logger;
    this.screenshotIntervalMs = screenshotIntervalMs;
    this.screenshotTimer = null;
    this.screenshotCapturing = false;
    this.browserSession = null;
  }

  async emit(type, payload = {}) {
    if (!this.postEvent) return;
    await this.postEvent(this.runId, { type, ...payload });
  }

  async stepStart({ index, meta }) {
    await this.emit('step_start', { index, meta });
  }

  async stepEnd({ index, ok, error, meta }) {
    const body = { index, ok };
    if (error) body.error = error;
    if (meta && Object.keys(meta).length > 0) body.meta = meta;
    await this.emit('step_end', body);
  }

  async runStatus(status, extra = {}) {
    await this.emit('run_status', { status, ...extra });
  }

  async done(payload) {
    await this.emit('done', payload);
  }

  attachBrowserSession(session) {
    this.browserSession = session;
  }

  startScreenshotStream() {
    if (!this.browserSession?.page) return;
    this.stopScreenshotStream();
    const capture = async () => {
      if (this.screenshotCapturing) return;
      this.screenshotCapturing = true;
      try {
        const buffer = await this.browserSession.screenshot({ type: 'png', fullPage: false });
        const image = `data:image/png;base64,${buffer.toString('base64')}`;
        await this.emit('screenshot', { image });
      } catch (error) {
        this.logger.warn?.('Failed to capture screenshot', error);
      } finally {
        this.screenshotCapturing = false;
      }
    };
    // kick off immediately
    capture().catch(() => {});
    this.screenshotTimer = setInterval(() => {
      capture().catch(() => {});
    }, this.screenshotIntervalMs);
  }

  stopScreenshotStream() {
    if (this.screenshotTimer) {
      clearInterval(this.screenshotTimer);
      this.screenshotTimer = null;
    }
  }
}
