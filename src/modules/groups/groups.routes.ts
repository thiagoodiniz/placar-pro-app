import { Router } from 'express'
import {
    listGroups,
    createGroup,
    updateGroup,
    resetGroups,
    autoDistributeTeams,
    generateMatchesForGroup,
    generateAllGroupMatches,
} from './groups.controller'

export const groupsRouter = Router()

groupsRouter.get('/', listGroups)
groupsRouter.post('/', createGroup)
groupsRouter.patch('/:id', updateGroup)

groupsRouter.post('/:id/generate-matches', generateMatchesForGroup)
groupsRouter.post('/championship/:championshipId/reset', resetGroups)
groupsRouter.post('/championship/:championshipId/auto-distribute', autoDistributeTeams)
groupsRouter.post('/championship/:championshipId/generate-all-matches', generateAllGroupMatches)
