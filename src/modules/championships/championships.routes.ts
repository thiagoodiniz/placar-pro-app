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

export const championshipsRouter = Router()

championshipsRouter.get('/', listChampionships)
championshipsRouter.get('/:id', getChampionship)
championshipsRouter.post('/', createChampionship)
championshipsRouter.patch('/:id', updateChampionship)
championshipsRouter.delete('/:id', deleteChampionship)

championshipsRouter.post('/:id/start', startChampionship)
championshipsRouter.post('/:id/finalize', finalizeStart)
championshipsRouter.post('/:id/finish', finishChampionship)
championshipsRouter.post('/:id/reset-matches', resetMatches)

championshipsRouter.get('/:id/standings', getStandings)
championshipsRouter.get('/:id/scorers', getTopScorers)
championshipsRouter.get('/:id/top-scorers', getTopScorers)

championshipsRouter.post('/:id/auto-results', fillRandomResults)

championshipsRouter.post('/:id/next-phase-preview', generateNextPhasePreview)
championshipsRouter.post('/:id/next-phase', generateNextPhaseMatches)
