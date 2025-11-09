export class DomainError extends Error {
  constructor(message, metadata = null) {
    super(message);
    this.name = new.target.name;
    this.metadata = metadata ?? undefined;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class InvariantViolationError extends DomainError {}

export class InvalidTransitionError extends DomainError {}

export class NotFoundError extends DomainError {}

export class DuplicateEntityError extends DomainError {}

export class ValidationError extends DomainError {}
