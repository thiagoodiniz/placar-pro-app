import { Router } from 'express'
import {
    listTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    addPlayer,
    updatePlayer,
    removePlayer,
    getTeam,
    getTeamMatches,
} from './teams.controller'

import { authMiddleware, roleMiddleware } from '../../middlewares/auth'

export const teamsRouter = Router()

const writeRoles = ['ADMIN', 'MANAGER']

teamsRouter.get('/', listTeams)
teamsRouter.get('/:id', getTeam)
teamsRouter.get('/:id/matches', getTeamMatches)

teamsRouter.post('/', authMiddleware, roleMiddleware(writeRoles), createTeam)
teamsRouter.patch('/:id', authMiddleware, roleMiddleware(writeRoles), updateTeam)
teamsRouter.delete('/:id', authMiddleware, roleMiddleware(writeRoles), deleteTeam)

teamsRouter.post('/:id/players', authMiddleware, roleMiddleware(writeRoles), addPlayer)
teamsRouter.patch('/:id/players/:playerId', authMiddleware, roleMiddleware(writeRoles), updatePlayer)
teamsRouter.delete('/:id/players/:playerId', authMiddleware, roleMiddleware(writeRoles), removePlayer)
