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

export const teamsRouter = Router()

teamsRouter.get('/', listTeams)
teamsRouter.get('/:id', getTeam)
teamsRouter.get('/:id/matches', getTeamMatches)
teamsRouter.post('/', createTeam)
teamsRouter.patch('/:id', updateTeam)
teamsRouter.delete('/:id', deleteTeam)

teamsRouter.post('/:id/players', addPlayer)
teamsRouter.patch('/:id/players/:playerId', updatePlayer)
teamsRouter.delete('/:id/players/:playerId', removePlayer)
