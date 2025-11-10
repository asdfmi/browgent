import { ValidationError, NotFoundError, InvariantViolationError } from '#domain/errors.js';

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((error) => handleHttpError(res, error));
  };
}

export function handleHttpError(res, error) {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: 'validation_failed', message: error.message });
    return;
  }
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: 'not_found', message: error.message });
    return;
  }
  if (error instanceof InvariantViolationError) {
    res.status(409).json({ error: 'conflict', message: error.message });
    return;
  }
  console.error('API error', error);
  res.status(500).json({ error: 'internal_error', message: 'Unexpected server error' });
}
