import 'dotenv/config'
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enableLogs: true,
    integrations: [
        nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    sendDefaultPii: true,
});

import { app } from './app'

const port = Number(process.env.PORT || 3001)

app.listen(port, () => {
    console.log(`🚀 Placar Pro API rodando na porta: ${port}`)
})
