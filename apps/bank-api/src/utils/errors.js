export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function assertNoDatabaseError(error, message = 'Database operation failed') {
  if (error) throw new ApiError(500, message, error.message)
}
