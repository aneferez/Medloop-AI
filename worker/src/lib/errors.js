// Typed API error carrying an HTTP status and a stable machine-readable code.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (message, details) => new ApiError(400, 'bad_request', message, details)
export const unauthorized = (message = 'Authentication required.') => new ApiError(401, 'unauthorized', message)
export const forbidden = (message = 'Not allowed.') => new ApiError(403, 'forbidden', message)
export const notFound = (message = 'Not found.') => new ApiError(404, 'not_found', message)
export const conflict = (message, details) => new ApiError(409, 'conflict', message, details)
export const tooManyRequests = (message = 'Too many requests. Please slow down.') =>
  new ApiError(429, 'too_many_requests', message)
export const unsupportedMedia = (message = 'Expected application/json request body.') =>
  new ApiError(415, 'unsupported_media_type', message)
export const validationError = (details) =>
  new ApiError(422, 'validation_failed', 'Request validation failed.', details)
