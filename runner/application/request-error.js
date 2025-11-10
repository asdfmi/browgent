export default class RequestError extends Error {
  constructor(status, body) {
    super(body?.error || 'request_error');
    this.name = 'RequestError';
    this.status = status;
    this.body = body;
  }
}
