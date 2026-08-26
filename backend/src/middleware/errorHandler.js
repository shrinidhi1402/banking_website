import { ApiError } from '../utils/errors.js'

export function notFound(req, res) { res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }) }

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)
  const status = error instanceof ApiError ? error.status : 500
  const body = { error: error instanceof ApiError ? error.message : 'Internal server error' }
  if (error.details && status < 500) body.details = error.details
  if (status >= 500) console.error(error)
  res.status(status).json(body)
}
