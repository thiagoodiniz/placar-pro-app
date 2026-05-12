import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'
import { cacheManager } from '../../lib/cache'

export async function listMatches(req: Request, res: Response) {
    const championshipId = req.query.championshipId ? String(req.query.championshipId) : undefined
    const cacheKey = championshipId ? `matches:list:${championshipId}` : 'matches:list:all'
    const cached = cacheManager.get(cacheKey)
    if (cached) return res.json(cached)

    const matches = await prisma.match.findMany({
        where: championshipId ? { championshipId } : {},
        include: {
            homeTeam: true,
            awayTeam: true,
            group: true,
            goals: true,
        },
        orderBy: [
            { round: 'asc' },
            { dateTime: { sort: 'asc', nulls: 'last' } as any },
            { createdAt: 'asc' },
            { id: 'asc' }
        ],
    })

    const result = matches.map(m => ({
        ...m,
        groupName: m.group?.name ?? null,
    }))

    cacheManager.set(cacheKey, result)
    return res.json(result)
}

export async function createMatch(req: Request, res: Response) {
    const { championshipId, groupId, homeTeamId, awayTeamId, phase, bracket, round, location, dateTime } = req.body
    const match = await prisma.match.create({
        data: {
            championshipId,
            groupId,
            homeTeamId,
            awayTeamId,
            homeScore: null,
            awayScore: null,
            status: 'SCHEDULED',
            phase,
            bracket,
            round: round ?? 1,
            location,
            dateTime: dateTime ? new Date(dateTime) : undefined,
        },
        include: { homeTeam: true, awayTeam: true, goals: true },
    })
    
    cacheManager.del([
        `matches:list:${championshipId}`,
        `teams:matches:${homeTeamId}`,
        `teams:matches:${awayTeamId}`,
        `teams:detail:${homeTeamId}`,
        `teams:detail:${awayTeamId}`
    ])
    
    return res.status(201).json(match)
}

export async function updateMatch(req: Request, res: Response) {
    const id = String(req.params.id)
    const { homeScore, awayScore, homePenalties, awayPenalties, location, dateTime, goals } = req.body

    const status = homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined
        ? 'FINISHED' as const
        : 'SCHEDULED' as const

    if (goals !== undefined) {
        await prisma.goal.deleteMany({ where: { matchId: id } })
        if (goals.length > 0) {
            await prisma.goal.createMany({
                data: goals.map((g: { playerId: string; teamId: string; playerName: string; teamName: string }) => ({
                    matchId: id,
                    playerId: g.playerId,
                    teamId: g.teamId,
                    playerName: g.playerName,
                    teamName: g.teamName,
                })),
            })
        }
    }

    const match = await prisma.match.update({
        where: { id },
        data: {
            ...(homeScore !== undefined && { homeScore }),
            ...(awayScore !== undefined && { awayScore }),
            ...(homePenalties !== undefined && { homePenalties }),
            ...(awayPenalties !== undefined && { awayPenalties }),
            ...(location !== undefined && { location }),
            ...(dateTime !== undefined && { dateTime: new Date(dateTime) }),
            status,
        },
        include: { homeTeam: true, awayTeam: true, goals: true },
    })

    // Invalidate caches
    cacheManager.del([
        `matches:list:${match.championshipId}`,
        `championships:standings:${match.championshipId}`,
        `championships:scorers:${match.championshipId}`,
        `teams:matches:${match.homeTeamId}`,
        `teams:matches:${match.awayTeamId}`,
        `teams:detail:${match.homeTeamId}`,
        `teams:detail:${match.awayTeamId}`,
        'teams:list'
    ])

    return res.json(match)
}
