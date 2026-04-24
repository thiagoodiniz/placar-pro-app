import { app } from './app'
import 'dotenv/config'

const port = Number(process.env.PORT || 3001)

app.listen(port, () => {
    console.log(`🚀 Placar Pro API rodando na porta: ${port}`)
})
