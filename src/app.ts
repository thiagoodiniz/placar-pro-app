import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"
import { routes } from './routes'
import { errorMiddleware } from './middlewares/error'

export const app = express()

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
        nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    sendDefaultPii: true,
});

const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || []

app.use(
    cors({
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            if (!origin) return callback(null, true)
            if (
                process.env.NODE_ENV === 'development' ||
                allowedOrigins.indexOf(origin) !== -1 ||
                allowedOrigins.includes('*')
            ) {
                callback(null, true)
            } else {
                callback(new Error('Not allowed by CORS'))
            }
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    })
)

app.use(express.json())

app.use(routes)

Sentry.setupExpressErrorHandler(app);

app.use(errorMiddleware)
