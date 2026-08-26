import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import routes from './routes/index.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

const app = express()
app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) }))
app.use(express.json({ limit: '50kb' }))
app.use(morgan('combined'))
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'northstar-banking-backend' }))
app.use('/api', routes)
app.use(notFound)
app.use(errorHandler)

app.listen(env.PORT, () => console.log(`Northstar backend listening on port ${env.PORT}`))
