import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function listGroups(req: Request, res: Response) {
    const championshipId = req.query.championshipId ? String(req.query.championshipId) : undefined
    const groups = await prisma.group.findMany({
        where: championshipId ? { championshipId } : {},
        include: { teams: { include: { team: true } } },
    })
    return res.json(groups)
}

export async function createGroup(req: Request, res: Response) {
    const { championshipId, name, teamIds = [] } = req.body as { championshipId: string; name: string; teamIds?: string[] }
    const group = await prisma.group.create({
        data: {
            championshipId,
            name,
            teams: { create: teamIds.map((teamId: string) => ({ teamId })) },
        },
        include: { teams: { include: { team: true } } },
    })
    return res.status(201).json(group)
}

export async function updateGroup(req: Request, res: Response) {
    const id = String(req.params.id)
    const { name, teamIds } = req.body as { name?: string; teamIds?: string[] }

    if (teamIds !== undefined) {
        await prisma.groupTeam.deleteMany({ where: { groupId: id } })
        if (teamIds.length > 0) {
            await prisma.groupTeam.createMany({ data: teamIds.map(teamId => ({ groupId: id, teamId })) })
        }
    }

    const group = await prisma.group.update({
        where: { id },
        data: { ...(name && { name }) },
        include: { teams: { include: { team: true } } },
    })
    return res.json(group)
}

export async function resetGroups(req: Request, res: Response) {
    const championshipId = String(req.params.id || req.params.championshipId)
    await prisma.match.deleteMany({ where: { championshipId } })
    const groups = await prisma.group.findMany({ where: { championshipId } })
    for (const g of groups) {
        await prisma.groupTeam.deleteMany({ where: { groupId: g.id } })
    }
    await prisma.championship.update({ where: { id: championshipId }, data: { matchMode: null } })
    return res.json({ message: 'Groups and matches reset' })
}

export async function autoDistributeTeams(req: Request, res: Response) {
    const championshipId = String(req.params.id || req.params.championshipId)
    const champ = await prisma.championship.findUnique({
        where: { id: championshipId },
        include: { teams: true },
    })
    if (!champ || champ.teams.length === 0) return res.json({ message: 'No teams to distribute' })

    const teamIds = [...champ.teams.map(t => t.teamId)].sort(() => Math.random() - 0.5)
    const groups = await prisma.group.findMany({ where: { championshipId } })
    if (groups.length === 0) return res.json({ message: 'No groups defined' })

    await prisma.groupTeam.deleteMany({ where: { groupId: { in: groups.map(g => g.id) } } })

    const data = teamIds.map((teamId, i) => ({ groupId: groups[i % groups.length].id, teamId }))
    await prisma.groupTeam.createMany({ data })

    return res.json({ message: 'Teams distributed' })
}

export async function generateMatchesForGroup(req: Request, res: Response) {
    const id = String(req.params.id)
    const group = await prisma.group.findUnique({ where: { id }, include: { teams: true } })
    if (!group) return res.status(404).json({ error: 'Group not found' })

    const teamIds = group.teams.map(t => t.teamId)
    if (teamIds.length < 2) return res.json({ message: 'Not enough teams' })

    const working = teamIds.length % 2 !== 0 ? [...teamIds, 'BYE'] : [...teamIds]
    const numRounds = working.length - 1
    const half = working.length / 2
    const matchData: { championshipId: string; groupId: string; homeTeamId: string; awayTeamId: string; phase: string; round: number; status: 'SCHEDULED' }[] = []
    const arr = [...working]
    for (let round = 1; round <= numRounds; round++) {
        for (let i = 0; i < half; i++) {
            const h = arr[i]; const a = arr[arr.length - 1 - i]
            if (h !== 'BYE' && a !== 'BYE') {
                const isEven = round % 2 === 0
                matchData.push({ championshipId: group.championshipId, groupId: id, homeTeamId: isEven ? a : h, awayTeamId: isEven ? h : a, phase: 'GROUP', round, status: 'SCHEDULED' })
            }
        }
        arr.splice(1, 0, arr.pop()!)
    }
    await prisma.match.createMany({ data: matchData })
    return res.json({ message: 'Matches generated' })
}

export async function generateAllGroupMatches(req: Request, res: Response) {
    const championshipId = String(req.params.id || req.params.championshipId)
    await prisma.match.deleteMany({ where: { championshipId, phase: 'GROUP' } })
    const groups = await prisma.group.findMany({ where: { championshipId }, include: { teams: true } })

    for (const group of groups) {
        const teamIds = group.teams.map(t => t.teamId)
        if (teamIds.length < 2) continue
        const working = teamIds.length % 2 !== 0 ? [...teamIds, 'BYE'] : [...teamIds]
        const numRounds = working.length - 1
        const half = working.length / 2
        const matchData: { championshipId: string; groupId: string; homeTeamId: string; awayTeamId: string; phase: string; round: number; status: 'SCHEDULED' }[] = []
        const arr = [...working]
        for (let round = 1; round <= numRounds; round++) {
            for (let i = 0; i < half; i++) {
                const h = arr[i]; const a = arr[arr.length - 1 - i]
                if (h !== 'BYE' && a !== 'BYE') {
                    const isEven = round % 2 === 0
                    matchData.push({ championshipId, groupId: group.id, homeTeamId: isEven ? a : h, awayTeamId: isEven ? h : a, phase: 'GROUP', round, status: 'SCHEDULED' })
                }
            }
            arr.splice(1, 0, arr.pop()!)
        }
        await prisma.match.createMany({ data: matchData })
    }
    return res.json({ message: 'All group matches generated' })
}
