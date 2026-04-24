import { Router, Request, Response } from 'express'
import { championshipsRouter } from './modules/championships/championships.routes'
import { teamsRouter } from './modules/teams/teams.routes'
import { groupsRouter } from './modules/groups/groups.routes'
import { matchesRouter } from './modules/matches/matches.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { addTeamsToChampionship } from './modules/championships/championships.controller'
import { 
    createGroup,
    updateGroup, 
    generateMatchesForGroup, 
    resetGroups, 
    autoDistributeTeams, 
    generateAllGroupMatches 
} from './modules/groups/groups.controller'
import { createMatch } from './modules/matches/matches.controller'

export const routes = Router()

routes.get('/health', (_req: Request, res: Response) => {
    return res.json({ ok: true, service: 'placar-pro-api' })
})

// Main Modules
routes.use('/championships', championshipsRouter)
routes.use('/teams', teamsRouter)
routes.use('/groups', groupsRouter)
routes.use('/matches', matchesRouter)
routes.use('/auth', authRoutes)

// ─── Legacy / Frontend Compatibility Routes ──────────────────────────────────

// Teams
routes.post('/teams/championship', (req: Request, res: Response) => {
    // Frontend sends { championshipId, teamIds }
    req.params.id = req.body.championshipId;
    return addTeamsToChampionship(req, res);
})

// Groups
routes.post('/championships/:id/groups', (req: Request, res: Response) => {
    req.body.championshipId = req.params.id;
    return createGroup(req, res);
})
routes.patch('/championships/groups/:id', updateGroup)
routes.post('/championships/groups/:id/generate-matches', generateMatchesForGroup)
routes.post('/championships/:id/groups/reset', resetGroups)
routes.post('/championships/:id/auto-distribute-teams', autoDistributeTeams)
routes.post('/championships/:id/generate-all-matches', generateAllGroupMatches)

// Matches
routes.post('/championships/match', createMatch)

// Players (Frontend uses PATCH /teams/:id/players/:playerId)
import { addPlayer, updatePlayer, removePlayer } from './modules/teams/teams.controller'
routes.post('/teams/:id/players', addPlayer)
routes.patch('/teams/:id/players/:playerId', updatePlayer)
routes.delete('/teams/:id/players/:playerId', removePlayer)
