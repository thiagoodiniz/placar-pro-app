import { Router } from 'express'
import { listMatches, createMatch, updateMatch } from './matches.controller'

import { authMiddleware, roleMiddleware } from '../../middlewares/auth'

export const matchesRouter = Router()

const writeRoles = ['ADMIN', 'MANAGER']

matchesRouter.get('/', listMatches)
matchesRouter.post('/', authMiddleware, roleMiddleware(writeRoles), createMatch)
matchesRouter.patch('/:id', authMiddleware, roleMiddleware(writeRoles), updateMatch)
matchesRouter.patch('/:id/details', authMiddleware, roleMiddleware(writeRoles), updateMatch)
