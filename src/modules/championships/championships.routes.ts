import { Router } from 'express'
import {
    listChampionships,
    createChampionship,
    updateChampionship,
    deleteChampionship,
    startChampionship,
    finalizeStart,
    finishChampionship,
    resetMatches,
    addTeamsToChampionship,
    getStandings,
    getTopScorers,
    fillRandomResults,
    generateNextPhasePreview,
    generateNextPhaseMatches,
    getChampionship,
} from './championships.controller'

import { authMiddleware, roleMiddleware } from '../../middlewares/auth'

export const championshipsRouter = Router()

const writeRoles = ['ADMIN', 'MANAGER']
const adminOnly = ['ADMIN']

championshipsRouter.get('/', listChampionships)
championshipsRouter.get('/:id', getChampionship)

championshipsRouter.post('/', authMiddleware, roleMiddleware(writeRoles), createChampionship)
championshipsRouter.patch('/:id', authMiddleware, roleMiddleware(writeRoles), updateChampionship)
championshipsRouter.delete('/:id', authMiddleware, roleMiddleware(writeRoles), deleteChampionship)

championshipsRouter.post('/:id/start', authMiddleware, roleMiddleware(writeRoles), startChampionship)
championshipsRouter.post('/:id/finalize', authMiddleware, roleMiddleware(writeRoles), finalizeStart)
championshipsRouter.post('/:id/finish', authMiddleware, roleMiddleware(writeRoles), finishChampionship)
championshipsRouter.post('/:id/reset-matches', authMiddleware, roleMiddleware(writeRoles), resetMatches)

championshipsRouter.get('/:id/standings', getStandings)
championshipsRouter.get('/:id/scorers', getTopScorers)
championshipsRouter.get('/:id/top-scorers', getTopScorers)

championshipsRouter.post('/:id/auto-results', authMiddleware, roleMiddleware(adminOnly), fillRandomResults)

championshipsRouter.post('/:id/next-phase-preview', authMiddleware, roleMiddleware(writeRoles), generateNextPhasePreview)
championshipsRouter.post('/:id/next-phase', authMiddleware, roleMiddleware(writeRoles), generateNextPhaseMatches)
