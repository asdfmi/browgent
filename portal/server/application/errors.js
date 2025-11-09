export class ApplicationError extends Error {
  constructor(message, metadata = null) {
    super(message);
    this.name = new.target.name;
    this.metadata = metadata ?? undefined;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class NotFoundApplicationError extends ApplicationError {}

export class ConflictApplicationError extends ApplicationError {}

export class InvalidRequestApplicationError extends ApplicationError {}
