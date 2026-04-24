import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'
import { cacheManager } from '../../lib/cache'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getWinnerId(m: {
    homeTeamId: string; awayTeamId: string;
    homeScore: number | null; awayScore: number | null;
    homePenalties: number | null; awayPenalties: number | null;
}): string {
    const h = m.homeScore ?? 0
    const a = m.awayScore ?? 0
    if (h > a) return m.homeTeamId
    if (a > h) return m.awayTeamId
    const hp = m.homePenalties ?? 0
    const ap = m.awayPenalties ?? 0
    if (hp > ap) return m.homeTeamId
    if (ap > hp) return m.awayTeamId
    return m.homeTeamId
}

async function computeStandingsForChampionship(championshipId: string) {
    let groups = await prisma.group.findMany({
        where: { championshipId },
        include: { teams: { include: { team: true } } },
    })

    const champ = await prisma.championship.findUnique({
        where: { id: championshipId },
        include: { teams: { include: { team: true } } },
    })

    // MOCK-API COMPATIBILITY: Auto-create groups if GROUPS_KNOCKOUT and none exist
    if (groups.length === 0 && champ?.format === 'GROUPS_KNOCKOUT') {
        const count = champ.groupCount || 1
        for (let i = 0; i < count; i++) {
            await prisma.group.create({
                data: { championshipId, name: `Grupo ${String.fromCharCode(65 + i)}` }
            })
        }
        groups = await prisma.group.findMany({
            where: { championshipId },
            include: { teams: { include: { team: true } } },
        })
    }

    const finishedMatches = await prisma.match.findMany({
        where: {
            championshipId,
            status: 'FINISHED',
            phase: { in: ['GROUP', 'LEAGUE'] },
        },
    })

    if (groups.length === 0) {
        // LEAGUE mode - group by 'geral'
        if (!champ || champ.teams.length === 0) return []
        const standings = champ.teams.map(ct => {
            const team = ct.team
            const tMatches = finishedMatches.filter(m => m.homeTeamId === team.id || m.awayTeamId === team.id)
            const stats = buildStats(team.id, team.name, team.logoUrl, tMatches)
            return stats
        })
        return [{ groupId: 'geral', groupName: 'Geral', standings: standings.sort(sortStandings) }]
    }

    return groups.map(group => {
        const groupMatches = finishedMatches.filter(m => m.groupId === group.id)
        const standings = group.teams.map(gt => {
            const team = gt.team
            const tMatches = groupMatches.filter(m => m.homeTeamId === team.id || m.awayTeamId === team.id)
            return buildStats(team.id, team.name, team.logoUrl, tMatches)
        })
        return { groupId: group.id, groupName: group.name, standings: standings.sort(sortStandings) }
    })
}

function buildStats(
    teamId: string, teamName: string, teamLogoUrl: string | null,
    matches: { homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null }[]
) {
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, points = 0
    for (const m of matches) {
        const isHome = m.homeTeamId === teamId
        const own = (isHome ? m.homeScore : m.awayScore) ?? 0
        const opp = (isHome ? m.awayScore : m.homeScore) ?? 0
        goalsFor += own; goalsAgainst += opp
        if (own > opp) { wins++; points += 3 }
        else if (own === opp) { draws++; points += 1 }
        else losses++
    }
    return { teamId, teamName, teamLogoUrl, played: matches.length, wins, draws, losses, goalsFor, goalsAgainst, gd: goalsFor - goalsAgainst, points }
}

function sortStandings(a: { points: number; gd: number; goalsFor: number }, b: { points: number; gd: number; goalsFor: number }) {
    return b.points - a.points || b.gd - a.gd || b.goalsFor - a.goalsFor
}

// ─── Controllers ─────────────────────────────────────────────────────────────

export async function listChampionships(_req: Request, res: Response) {
    const cacheKey = 'championships:list'
    const cached = cacheManager.get(cacheKey)
    if (cached) return res.json(cached)

    const championships = await prisma.championship.findMany({
        include: { teams: { include: { team: { select: { name: true, logoUrl: true } } } } },
        orderBy: { updatedAt: 'desc' },
    })

    const sorted = championships.sort((a, b) => {
        if (a.status === 'FINISHED' && b.status !== 'FINISHED') return 1
        if (a.status !== 'FINISHED' && b.status === 'FINISHED') return -1
        return b.updatedAt.getTime() - a.updatedAt.getTime()
    })

    cacheManager.set(cacheKey, sorted)
    return res.json(sorted)
}

export async function getChampionship(req: Request, res: Response) {
    const id = String(req.params.id)
    const cacheKey = `championships:detail:${id}`
    const cached = cacheManager.get(cacheKey)
    if (cached) return res.json(cached)

    const champ = await prisma.championship.findUnique({
        where: { id },
        include: { teams: { include: { team: true } } }
    })
    if (!champ) return res.status(404).json({ error: 'Championship not found' })
    
    cacheManager.set(cacheKey, champ)
    return res.json(champ)
}

export async function createChampionship(req: Request, res: Response) {
    const { name, format, teamCount, groupCount, advancingCount, roundTrip } = req.body
    const champ = await prisma.championship.create({
        data: { name, format, teamCount, groupCount, advancingCount, roundTrip: roundTrip ?? false, status: 'DRAFT' },
        include: { teams: { include: { team: true } } },
    })
    cacheManager.del('championships:list')
    return res.status(201).json(champ)
}

export async function updateChampionship(req: Request, res: Response) {
    const id = String(req.params.id)
    const data = req.body

    const original = await prisma.championship.findUnique({ where: { id } })
    if (!original) return res.status(404).json({ error: 'Championship not found' })

    const structuralFields = ['format', 'teamCount', 'groupCount', 'advancingCount']
    const isStructural = structuralFields.some(f => data[f] !== undefined && (data as any)[f] !== (original as any)[f])

    if (isStructural) {
        await prisma.match.deleteMany({ where: { championshipId: id } })
        await prisma.group.deleteMany({ where: { championshipId: id } })
        await prisma.championship.update({ where: { id }, data: { status: 'DRAFT', matchMode: null } })
    }

    const updated = await prisma.championship.update({
        where: { id },
        data,
        include: { teams: { include: { team: true } } },
    })
    
    cacheManager.del(['championships:list', `championships:detail:${id}`, `championships:standings:${id}`, `championships:scorers:${id}`, `matches:list:${id}`])
    return res.json(updated)
}

export async function deleteChampionship(req: Request, res: Response) {
    const id = String(req.params.id)
    await prisma.championship.delete({ where: { id } })
    cacheManager.del(['championships:list', `championships:detail:${id}`, `championships:standings:${id}`, `championships:scorers:${id}`, `matches:list:${id}`])
    return res.json({ message: 'Championship deleted' })
}

export async function resetMatches(req: Request, res: Response) {
    const id = String(req.params.id)
    await prisma.match.deleteMany({ where: { championshipId: id } })
    await prisma.group.deleteMany({ where: { championshipId: id } })
    await prisma.championship.update({ where: { id }, data: { status: 'DRAFT', matchMode: null } })
    cacheManager.del(['championships:list', `championships:detail:${id}`, `championships:standings:${id}`, `championships:scorers:${id}`, `matches:list:${id}`])
    return res.json({ message: 'Reset successful' })
}

export async function startChampionship(req: Request, res: Response) {
    const id = String(req.params.id)
    const { mode } = req.body as { mode: 'RANDOM' | 'MANUALLY' }

    const champ = await prisma.championship.findUnique({
        where: { id },
        include: { teams: true },
    })
    if (!champ) return res.status(404).json({ error: 'Championship not found' })

    await prisma.championship.update({ where: { id }, data: { matchMode: mode } })

    if (mode === 'RANDOM') {
        await generateAutoMatchesLogic(id, champ)
    } else if (mode === 'MANUALLY' && champ.format === 'GROUPS_KNOCKOUT') {
        const count = champ.groupCount || 1
        for (let i = 0; i < count; i++) {
            await prisma.group.create({ data: { championshipId: id, name: `Grupo ${String.fromCharCode(65 + i)}` } })
        }
    }

    cacheManager.del(['championships:list', `championships:detail:${id}`, `championships:standings:${id}`, `championships:scorers:${id}`, `matches:list:${id}`])
    return res.json({ message: 'Started' })
}

export async function finalizeStart(req: Request, res: Response) {
    const id = String(req.params.id)
    await prisma.championship.update({ where: { id }, data: { status: 'STARTED' } })
    cacheManager.del(['championships:list', `championships:detail:${id}`])
    return res.json({ message: 'Finalized' })
}

export async function finishChampionship(req: Request, res: Response) {
    const id = String(req.params.id)
    const champ = await prisma.championship.findUnique({ where: { id } })
    if (!champ) return res.status(404).json({ error: 'Championship not found' })

    let champion: string | undefined
    let silverChampion: string | undefined

    if (champ.format === 'LEAGUE') {
        const matches = await prisma.match.findMany({
            where: { championshipId: id, status: 'FINISHED' },
            include: { homeTeam: true, awayTeam: true },
        })
        const pointsMap: Record<string, { pts: number; gd: number; name: string }> = {}
        for (const m of matches) {
            const h = m.homeScore ?? 0; const a = m.awayScore ?? 0
            if (!pointsMap[m.homeTeamId]) pointsMap[m.homeTeamId] = { pts: 0, gd: 0, name: m.homeTeam.name }
            if (!pointsMap[m.awayTeamId]) pointsMap[m.awayTeamId] = { pts: 0, gd: 0, name: m.awayTeam.name }
            pointsMap[m.homeTeamId].gd += h - a
            pointsMap[m.awayTeamId].gd += a - h
            if (h > a) pointsMap[m.homeTeamId].pts += 3
            else if (a > h) pointsMap[m.awayTeamId].pts += 3
            else { pointsMap[m.homeTeamId].pts += 1; pointsMap[m.awayTeamId].pts += 1 }
        }
        const sorted = Object.values(pointsMap).sort((a, b) => b.pts - a.pts || b.gd - a.gd)
        if (sorted.length > 0) champion = sorted[0].name
    } else {
        const finals = await prisma.match.findMany({
            where: { championshipId: id, phase: 'FINAL' },
            include: { homeTeam: true, awayTeam: true },
        })
        const goldFinal = finals.find(m => (m.bracket || 'GOLD') === 'GOLD')
        if (goldFinal) {
            const winnerId = getWinnerId(goldFinal)
            champion = goldFinal.homeTeamId === winnerId ? goldFinal.homeTeam.name : goldFinal.awayTeam.name
        }
        const silverFinal = finals.find(m => m.bracket === 'SILVER')
        if (silverFinal) {
            const winnerId = getWinnerId(silverFinal)
            silverChampion = silverFinal.homeTeamId === winnerId ? silverFinal.homeTeam.name : silverFinal.awayTeam.name
        }
    }

    const updated = await prisma.championship.update({
        where: { id },
        data: { status: 'FINISHED', champion, silverChampion },
    })
    
    cacheManager.del(['championships:list', `championships:detail:${id}`])
    cacheManager.delByPrefix('teams:detail:') // Stats changed
    cacheManager.del('teams:list')

    return res.json(updated)
}

export async function addTeamsToChampionship(req: Request, res: Response) {
    const id = String(req.params.id)
    const { teamIds } = req.body as { teamIds: string[] }

    await prisma.championshipTeam.deleteMany({ where: { championshipId: id } })
    await prisma.championshipTeam.createMany({
        data: teamIds.map(teamId => ({ championshipId: id, teamId })),
    })

    const updated = await prisma.championship.findUnique({
        where: { id },
        include: { teams: { include: { team: true } } },
    })
    
    cacheManager.del(['championships:list', `championships:detail:${id}`, `championships:standings:${id}`, `matches:list:${id}`])
    cacheManager.delByPrefix('teams:detail:')
    cacheManager.del('teams:list')

    return res.json(updated)
}

export async function getStandings(req: Request, res: Response) {
    const id = String(req.params.id)
    const cacheKey = `championships:standings:${id}`
    const cached = cacheManager.get(cacheKey)
    if (cached) return res.json(cached)

    const standings = await computeStandingsForChampionship(id)
    cacheManager.set(cacheKey, standings)
    return res.json(standings)
}

export async function getTopScorers(req: Request, res: Response) {
    const id = String(req.params.id)
    const cacheKey = `championships:scorers:${id}`
    const cached = cacheManager.get(cacheKey)
    if (cached) return res.json(cached)

    const goals = await prisma.goal.findMany({
        where: { match: { championshipId: id } },
        include: { player: { include: { team: true } } },
    })

    const scores: Record<string, { playerId: string; player: string; photoUrl: string | null; teamId: string; team: string; teamLogoUrl: string | null; goals: number }> = {}
    for (const g of goals) {
        if (!scores[g.playerId]) {
            scores[g.playerId] = {
                playerId: g.playerId,
                player: g.playerName,
                photoUrl: g.player.photoUrl,
                teamId: g.teamId,
                team: g.teamName,
                teamLogoUrl: g.player.team.logoUrl,
                goals: 0,
            }
        }
        scores[g.playerId].goals++
    }

    const result = Object.values(scores).sort((a, b) => b.goals - a.goals)
    cacheManager.set(cacheKey, result)
    return res.json(result)
}

export async function fillRandomResults(req: Request, res: Response) {
    const id = String(req.params.id)
    const allMatches = await prisma.match.findMany({
        where: { championshipId: id },
        include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } } },
    })

    if (allMatches.length === 0) return res.json({ message: 'No matches to update' })

    const phaseOrder = ['GROUP', 'LEAGUE', 'ROUND_16', 'QUARTER', 'SEMI', 'FINAL']
    const currentPhase = allMatches.reduce((latest, m) => {
        const p = m.phase || 'GROUP'
        return phaseOrder.indexOf(p) > phaseOrder.indexOf(latest) ? p : latest
    }, 'GROUP')

    const matchesToUpdate = allMatches.filter(m => 
        (m.phase || 'GROUP') === currentPhase && 
        m.status !== 'FINISHED'
    )

    const updates = matchesToUpdate.map(m => {
        const homeScore = Math.floor(Math.random() * 6)
        const awayScore = Math.floor(Math.random() * 6)

        const goalData: { playerId: string; teamId: string; playerName: string; teamName: string }[] = []

        for (let i = 0; i < homeScore; i++) {
            const players = m.homeTeam.players
            if (players.length > 0) {
                const p = players[Math.floor(Math.random() * players.length)]
                goalData.push({ playerId: p.id, teamId: m.homeTeamId, playerName: p.name, teamName: m.homeTeam.name })
            }
        }
        for (let i = 0; i < awayScore; i++) {
            const players = m.awayTeam.players
            if (players.length > 0) {
                const p = players[Math.floor(Math.random() * players.length)]
                goalData.push({ playerId: p.id, teamId: m.awayTeamId, playerName: p.name, teamName: m.awayTeam.name })
            }
        }

        return [
            prisma.goal.deleteMany({ where: { matchId: m.id } }),
            prisma.match.update({
                where: { id: m.id },
                data: { homeScore, awayScore, status: 'FINISHED', goals: { create: goalData } },
            })
        ]
    }).flat()

    await prisma.$transaction(updates)
    
    cacheManager.del([`matches:list:${id}`, `championships:standings:${id}`, `championships:scorers:${id}`])
    cacheManager.delByPrefix('teams:matches:')
    cacheManager.delByPrefix('teams:detail:')
    cacheManager.del('teams:list')

    return res.json({ message: 'Random results generated' })
}

// ─── Next Phase Logic ────────────────────────────────────────────────────────

async function calculateNextPhaseMatches(championshipId: string) {
    const champ = await prisma.championship.findUnique({ where: { id: championshipId } })
    if (!champ) throw new Error('Championship not found')

    const allMatches = await prisma.match.findMany({ where: { championshipId } })
    const phaseOrder = ['GROUP', 'LEAGUE', 'ROUND_16', 'QUARTER', 'SEMI', 'FINAL']
    const existingPhases = [...new Set(allMatches.map(m => m.phase || 'GROUP'))]
    const currentPhase = existingPhases.length > 0 
        ? existingPhases.sort((a, b) => phaseOrder.indexOf(b) - phaseOrder.indexOf(a))[0]
        : 'GROUP'

    let nextPhase = ''
    const advancingTeams: { teamId: string; teamName: string; teamLogoUrl: string | null; bracket?: string }[] = []
    const previewMatches: {
        championshipId: string; homeTeamId: string; awayTeamId: string;
        phase: string; bracket: string; round: number; status: string; homeScore: null; awayScore: null; goals: never[]
    }[] = []

    const standings = await computeStandingsForChampionship(championshipId)

    if (currentPhase === 'GROUP') {
        const advancingCount = champ.advancingCount || 2
        const advancing: { teamId: string; teamName: string; teamLogoUrl: string | null }[] = []
        for (const group of standings) {
            advancing.push(...group.standings.slice(0, advancingCount).map(s => ({ teamId: s.teamId, teamName: s.teamName, teamLogoUrl: s.teamLogoUrl })))
        }

        const total = advancing.length
        if (total === 16) nextPhase = 'ROUND_16'
        else if (total === 8) nextPhase = 'QUARTER'
        else if (total === 4) nextPhase = 'SEMI'
        else if (total === 2) nextPhase = 'FINAL'
        else throw new Error(`Número inválido de classificados: ${total}`)

        let teams = advancing
        if (champ.knockoutMode !== 'RANKED') {
            teams = [...advancing].sort(() => Math.random() - 0.5)
        } else if (standings.length === 1) {
            const adv = standings[0].standings.slice(0, advancingCount)
            const numMatches = adv.length / 2
            for (let i = 0; i < numMatches; i++) {
                previewMatches.push({ championshipId, homeTeamId: adv[i].teamId, awayTeamId: adv[adv.length - 1 - i].teamId, phase: nextPhase, bracket: 'GOLD', round: 1, status: 'SCHEDULED', homeScore: null, awayScore: null, goals: [] })
            }
            advancingTeams.push(...adv.map(s => ({ teamId: s.teamId, teamName: s.teamName, teamLogoUrl: s.teamLogoUrl })))
            return { nextPhase, advancingTeams, previewMatches }
        } else {
            for (let g = 0; g < standings.length; g += 2) {
                const groupA = standings[g].standings.slice(0, advancingCount)
                const groupB = standings[g + 1] ? standings[g + 1].standings.slice(0, advancingCount) : []
                for (let i = 0; i < Math.min(groupA.length, groupB.length); i++) {
                    const home = groupA[i]; const away = groupB[advancingCount - 1 - i]
                    if (home && away) previewMatches.push({ championshipId, homeTeamId: home.teamId, awayTeamId: away.teamId, phase: nextPhase, bracket: 'GOLD', round: 1, status: 'SCHEDULED', homeScore: null, awayScore: null, goals: [] })
                }
            }
            advancingTeams.push(...advancing)
            return { nextPhase, advancingTeams, previewMatches }
        }

        advancingTeams.push(...teams)
        const numMatches = teams.length / 2
        for (let i = 0; i < numMatches; i++) {
            const home = teams[i * 2]; const away = teams[i * 2 + 1]
            if (home && away) previewMatches.push({ championshipId, homeTeamId: home.teamId, awayTeamId: away.teamId, phase: nextPhase, bracket: 'GOLD', round: 1, status: 'SCHEDULED', homeScore: null, awayScore: null, goals: [] })
        }
    } else {
        const phaseMatches = allMatches.filter(m => m.phase === currentPhase)
        const brackets: ('GOLD' | 'SILVER')[] = ['GOLD', 'SILVER']

        for (const bracket of brackets) {
            const bMatches = phaseMatches.filter(m => (m.bracket || 'GOLD') === bracket)
            if (bMatches.length === 0) continue

            const bAdvancing: { teamId: string; teamName: string; teamLogoUrl: string | null }[] = []
            const teams = await prisma.team.findMany({ where: { id: { in: bMatches.flatMap(m => [m.homeTeamId, m.awayTeamId]) } } })

            for (const m of bMatches) {
                if (m.homeScore !== null && m.awayScore !== null && m.status === 'FINISHED') {
                    const winnerId = getWinnerId(m)
                    const winnerTeam = teams.find(t => t.id === winnerId)
                    bAdvancing.push({ teamId: winnerId, teamName: winnerTeam?.name || 'Desconhecido', teamLogoUrl: winnerTeam?.logoUrl || null })
                }
            }

            advancingTeams.push(...bAdvancing.map(t => ({ ...t, bracket })))

            const total = bAdvancing.length
            let bNextPhase = ''
            if (total === 8) bNextPhase = 'QUARTER'
            else if (total === 4) bNextPhase = 'SEMI'
            else if (total === 2) bNextPhase = 'FINAL'

            if (bNextPhase && !nextPhase) nextPhase = bNextPhase

            for (let i = 0; i < bAdvancing.length / 2; i++) {
                const home = bAdvancing[i * 2]; const away = bAdvancing[i * 2 + 1]
                if (home && away) previewMatches.push({ championshipId, homeTeamId: home.teamId, awayTeamId: away.teamId, phase: bNextPhase, bracket, round: 1, status: 'SCHEDULED', homeScore: null, awayScore: null, goals: [] })
            }
        }
    }

    if (!nextPhase) throw new Error('Could not determine next phase')
    return { nextPhase, advancingTeams, previewMatches }
}

export async function generateNextPhasePreview(req: Request, res: Response) {
    const id = String(req.params.id)
    const result = await calculateNextPhaseMatches(id)
    return res.json(result)
}

export async function generateNextPhaseMatches(req: Request, res: Response) {
    const id = String(req.params.id)
    const { manualMatches, matches } = req.body as { 
        manualMatches?: { homeTeamId: string; awayTeamId: string; bracket?: 'GOLD' | 'SILVER' }[],
        matches?: { homeTeamId: string; awayTeamId: string; bracket?: 'GOLD' | 'SILVER' }[]
    }

    const incomingMatches = manualMatches || matches
    const { nextPhase, previewMatches } = await calculateNextPhaseMatches(id)

    const finalMatches = incomingMatches && incomingMatches.length > 0
        ? incomingMatches.map(m => ({ championshipId: id, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, phase: nextPhase, bracket: m.bracket || 'GOLD' as const, round: 1, status: 'SCHEDULED' as const }))
        : previewMatches.map(m => ({ championshipId: id, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, phase: m.phase, bracket: m.bracket as 'GOLD' | 'SILVER', round: m.round, status: 'SCHEDULED' as const }))

    await prisma.match.createMany({ data: finalMatches })
    
    cacheManager.del([`matches:list:${id}`, `championships:detail:${id}`, `championships:standings:${id}`])
    cacheManager.delByPrefix('teams:matches:')
    
    return res.json({ message: 'Próxima fase gerada com sucesso' })
}

// ─── Auto-generate matches (internal) ───────────────────────────────────────

async function generateAutoMatchesLogic(championshipId: string, champ: { format: string; groupCount: number | null; teams: { teamId: string }[]; roundTrip: boolean }) {
    const teamIds = champ.teams.map(t => t.teamId)

    if (champ.format === 'KNOCKOUT') {
        for (let i = 0; i < teamIds.length; i += 2) {
            if (teamIds[i] && teamIds[i + 1]) {
                await prisma.match.create({ data: { championshipId, homeTeamId: teamIds[i], awayTeamId: teamIds[i + 1], phase: 'ROUND_16', round: 1, status: 'SCHEDULED' } })
            }
        }
    } else if (champ.format === 'GROUPS_KNOCKOUT') {
        const groupCount = champ.groupCount || 1
        const groups: { id: string }[] = []
        for (let i = 0; i < groupCount; i++) {
            const g = await prisma.group.create({ data: { championshipId, name: `Grupo ${String.fromCharCode(65 + i)}` } })
            groups.push(g)
        }
        for (let i = 0; i < teamIds.length; i++) {
            const groupIdx = i % groupCount
            await prisma.groupTeam.create({ data: { groupId: groups[groupIdx].id, teamId: teamIds[i] } })
        }
        for (const g of groups) {
            await generateMatchesForGroupLogic(g.id)
        }
    } else if (champ.format === 'LEAGUE') {
        const working = teamIds.length % 2 !== 0 ? [...teamIds, 'BYE'] : [...teamIds]
        const numRounds = working.length - 1
        const half = working.length / 2
        const matchData: { championshipId: string; homeTeamId: string; awayTeamId: string; phase: string; round: number; status: 'SCHEDULED'; groupId: string }[] = []
        const arr = [...working]
        for (let round = 1; round <= numRounds; round++) {
            for (let i = 0; i < half; i++) {
                const h = arr[i]; const a = arr[arr.length - 1 - i]
                if (h !== 'BYE' && a !== 'BYE') {
                    const isEven = round % 2 === 0
                    matchData.push({ championshipId, homeTeamId: isEven ? a : h, awayTeamId: isEven ? h : a, phase: 'LEAGUE', round, status: 'SCHEDULED', groupId: 'geral' })
                    if (champ.roundTrip) {
                        matchData.push({ championshipId, homeTeamId: isEven ? h : a, awayTeamId: isEven ? a : h, phase: 'LEAGUE', round: round + numRounds, status: 'SCHEDULED', groupId: 'geral' })
                    }
                }
            }
            arr.splice(1, 0, arr.pop()!)
        }
        await prisma.match.createMany({ data: matchData })
    }
}

async function generateMatchesForGroupLogic(groupId: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, include: { teams: true } })
    if (!group) return

    const teamIds = group.teams.map(t => t.teamId)
    if (teamIds.length < 2) return

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
                matchData.push({ championshipId: group.championshipId, groupId, homeTeamId: isEven ? a : h, awayTeamId: isEven ? h : a, phase: 'GROUP', round, status: 'SCHEDULED' })
            }
        }
        arr.splice(1, 0, arr.pop()!)
    }
    await prisma.match.createMany({ data: matchData })
}
