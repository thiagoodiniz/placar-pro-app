import { Router } from 'express'
import { listMatches, createMatch, updateMatch } from './matches.controller'

export const matchesRouter = Router()

matchesRouter.get('/', listMatches)
matchesRouter.post('/', createMatch)
matchesRouter.patch('/:id', updateMatch)
matchesRouter.patch('/:id/details', updateMatch)
