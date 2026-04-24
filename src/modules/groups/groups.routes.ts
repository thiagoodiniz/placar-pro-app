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

import { authMiddleware, roleMiddleware } from '../../middlewares/auth'

export const groupsRouter = Router()

const writeRoles = ['ADMIN', 'MANAGER']

groupsRouter.get('/', listGroups)
groupsRouter.post('/', authMiddleware, roleMiddleware(writeRoles), createGroup)
groupsRouter.patch('/:id', authMiddleware, roleMiddleware(writeRoles), updateGroup)

groupsRouter.post('/:id/generate-matches', authMiddleware, roleMiddleware(writeRoles), generateMatchesForGroup)
groupsRouter.post('/championship/:championshipId/reset', authMiddleware, roleMiddleware(writeRoles), resetGroups)
groupsRouter.post('/championship/:championshipId/auto-distribute', authMiddleware, roleMiddleware(writeRoles), autoDistributeTeams)
groupsRouter.post('/championship/:championshipId/generate-all-matches', authMiddleware, roleMiddleware(writeRoles), generateAllGroupMatches)
