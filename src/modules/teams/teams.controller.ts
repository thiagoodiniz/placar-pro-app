import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'
import { cacheManager } from '../../lib/cache'

export async function listTeams(_req: Request, res: Response) {
    const cacheKey = 'teams:list'
    const cached = cacheManager.get(cacheKey)
    if (cached) return res.json(cached)

    // 1. Fetch only essential team data and counts
    const teams = await prisma.team.findMany({
        select: {
            id: true,
            name: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            _count: {
                select: {
                    players: true,
                    championships: true,
                }
            }
        },
        orderBy: { name: 'asc' },
    })

    // 2. Assemble results
    const result = teams.map((team) => {
        return {
            ...team,
            stats: {
                playerCount: team._count.players,
                championshipCount: team._count.championships,
            },
        };
    });

    cacheManager.set(cacheKey, result)
    return res.json(result);
}

export async function getTeam(req: Request, res: Response) {
    const id = String(req.params.id)
    const cacheKey = `teams:detail:${id}`
    const cached = cacheManager.get(cacheKey)
    if (cached) return res.json(cached)

    const team = await prisma.team.findUnique({
        where: { id },
        include: { players: true },
    })
    if (!team) return res.status(404).json({ error: 'Team not found' })

    const participatedChampionships = await prisma.championship.findMany({
        where: { teams: { some: { teamId: id } } },
        select: { id: true, name: true, status: true }
    })

    const titles = await prisma.championship.count({
        where: { champion: team.name }
    })

    // Fetch last finished match
    const lastMatchRaw = await prisma.match.findFirst({
        where: {
            OR: [{ homeTeamId: id }, { awayTeamId: id }],
            status: 'FINISHED'
        },
        orderBy: { dateTime: 'desc' },
        select: {
            id: true,
            homeScore: true,
            awayScore: true,
            dateTime: true,
            homeTeamId: true,
            awayTeamId: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
        }
    });

    // Fetch next scheduled match
    const nextMatchRaw = await prisma.match.findFirst({
        where: {
            OR: [{ homeTeamId: id }, { awayTeamId: id }],
            status: 'SCHEDULED'
        },
        orderBy: { dateTime: 'asc' }, // Get the earliest scheduled match
        select: {
            id: true,
            dateTime: true,
            homeTeamId: true,
            awayTeamId: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
        }
    });

    const formatMatch = (m: any) => {
        if (!m) return null;
        const isHome = m.homeTeamId === team.id;
        return {
            ...m,
            opponentName: isHome ? m.awayTeam.name : m.homeTeam.name
        };
    };

    const result = {
        ...team,
        stats: {
            titles,
            championshipCount: participatedChampionships.length,
            playerCount: team.players.length,
            participatedChampionships,
            lastMatch: formatMatch(lastMatchRaw),
            nextMatch: formatMatch(nextMatchRaw),
        },
    }

    cacheManager.set(cacheKey, result)
    return res.json(result)
}

export async function createTeam(req: Request, res: Response) {
    const { name, logoUrl, primaryColor, secondaryColor } = req.body
    const team = await prisma.team.create({
        data: {
            name,
            logoUrl,
            primaryColor: primaryColor || '#166534',
            secondaryColor: secondaryColor || '#ffffff',
        },
        include: { players: true },
    })
    cacheManager.del('teams:list')
    return res.status(201).json(team)
}

export async function updateTeam(req: Request, res: Response) {
    const id = String(req.params.id)
    const { name, logoUrl, primaryColor, secondaryColor } = req.body
    const team = await prisma.team.update({
        where: { id },
        data: { name, logoUrl, primaryColor, secondaryColor },
        include: { players: true },
    })
    cacheManager.del(['teams:list', `teams:detail:${id}`])
    return res.json(team)
}

export async function deleteTeam(req: Request, res: Response) {
    const id = String(req.params.id)
    const userRole = (req as any).userRole

    const team = await prisma.team.findUnique({
        where: { id },
        include: { championships: true }
    })
    if (!team) return res.status(404).json({ error: 'Team not found' })

    if (team.championships.length > 0 && userRole !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can delete teams linked to championships' })
    }

    await prisma.team.delete({ where: { id } })
    cacheManager.del(['teams:list', `teams:detail:${id}`])
    return res.json({ message: 'Team deleted' })
}

export async function addPlayer(req: Request, res: Response) {
    const teamId = String(req.params.id)
    const { name, photoUrl } = req.body
    const player = await prisma.player.create({
        data: { teamId, name, photoUrl },
    })
    cacheManager.del([`teams:detail:${teamId}`, 'teams:list'])
    return res.status(201).json(player)
}

export async function updatePlayer(req: Request, res: Response) {
    const playerId = String(req.params.playerId)
    const { name, photoUrl } = req.body
    const player = await prisma.player.update({
        where: { id: playerId },
        data: { name, ...(photoUrl !== undefined && { photoUrl }) },
    })
    cacheManager.del([`teams:detail:${player.teamId}`, 'teams:list'])
    return res.json(player)
}

export async function removePlayer(req: Request, res: Response) {
    const playerId = String(req.params.playerId)
    const player = await prisma.player.findUnique({ where: { id: playerId } })
    if (player) {
        await prisma.player.delete({ where: { id: playerId } })
        cacheManager.del([`teams:detail:${player.teamId}`, 'teams:list'])
    }
    return res.json({ message: 'Player removed' })
}

export async function getTeamMatches(req: Request, res: Response) {
    const id = String(req.params.id)
    const cacheKey = `teams:matches:${id}`
    const cached = cacheManager.get(cacheKey)
    if (cached) return res.json(cached)

    // Verify team exists
    const team = await prisma.team.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!team) return res.status(404).json({ error: 'Team not found' })

    const allMatchesRaw = await prisma.match.findMany({
        where: {
            OR: [{ homeTeamId: id }, { awayTeamId: id }]
        },
        orderBy: { updatedAt: 'desc' },
        select: {
            id: true,
            homeScore: true,
            awayScore: true,
            dateTime: true,
            status: true,
            phase: true,
            location: true,
            homeTeamId: true,
            awayTeamId: true,
            homeTeam: { select: { name: true, logoUrl: true } },
            awayTeam: { select: { name: true, logoUrl: true } },
            championship: { select: { name: true } }
        }
    });

    const matches = allMatchesRaw.map(m => {
        const isHome = m.homeTeamId === team.id;
        return {
            ...m,
            opponentName: isHome ? m.awayTeam.name : m.homeTeam.name,
            opponentLogo: isHome ? m.awayTeam.logoUrl : m.homeTeam.logoUrl,
            isHome
        };
    });

    cacheManager.set(cacheKey, matches)
    return res.json(matches)
}
