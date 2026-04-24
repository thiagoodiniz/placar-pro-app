import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLUBS = [
    { id: 'flamengo', name: 'Flamengo', logo: 'https://ssl.gstatic.com/onebox/media/sports/logos/optimized/orE554NToSkH6nuwofe7Yg_96x96.png', color1: '#C8102E', color2: '#000000' },
    { id: 'vasco', name: 'Vasco', logo: 'https://ssl.gstatic.com/onebox/media/sports/logos/optimized/hHwT8LwRmYCAGxQ-STLxYA_96x96.png', color1: '#000000', color2: '#FFFFFF' },
    { id: 'fluminense', name: 'Fluminense', logo: 'https://ssl.gstatic.com/onebox/media/sports/logos/optimized/fCMxMMDF2AZPU7LzYKSlig_96x96.png', color1: '#7A263A', color2: '#006341' },
    { id: 'botafogo', name: 'Botafogo', logo: 'https://ssl.gstatic.com/onebox/media/sports/logos/optimized/KLDWYp-H8CAOT9H_JgizRg_96x96.png', color1: '#000000', color2: '#FFFFFF' },
    { id: 'palmeiras', name: 'Palmeiras', logo: 'https://ssl.gstatic.com/onebox/media/sports/logos/optimized/7spurne-xDt2p6C0imYYNA_96x96.png', color1: '#006437', color2: '#FFFFFF' },
    { id: 'santos', name: 'Santos', logo: 'https://ssl.gstatic.com/onebox/media/sports/logos/optimized/VHdNOT6wWOw_vJ38GMjMzg_96x96.png', color1: '#FFFFFF', color2: '#000000' },
    { id: 'corinthians', name: 'Corinthians', logo: 'https://ssl.gstatic.com/onebox/media/sports/logos/optimized/tCMSqgXVHROpdCpQhzTo1g_96x96.png', color1: '#000000', color2: '#FFFFFF' },
    { id: 'saopaulo', name: 'São Paulo', logo: 'https://ssl.gstatic.com/onebox/media/sports/logos/optimized/4w2Z97Hf9CSOqICK3a8AxQ_96x96.png', color1: '#E60026', color2: '#000000' },
]

const CATEGORIES = ['Sub-13', 'Sub-15', 'Sub-17']

const firstNames = ['João', 'Lucas', 'Gabriel', 'Mateus', 'Pedro', 'Davi', 'Rafael', 'Bruno', 'Thiago', 'Felipe']
const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes']

function rnd<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

async function main() {
    console.log('🌱 Iniciando seed...')

    // Create teams with players
    for (const club of CLUBS) {
        for (const cat of CATEGORIES) {
            const teamId = `t-${club.id}-${cat.toLowerCase().replace('-', '')}`
            const team = await prisma.team.upsert({
                where: { id: teamId },
                update: {},
                create: {
                    id: teamId,
                    name: `${club.name} ${cat}`,
                    logoUrl: club.logo,
                    primaryColor: club.color1,
                    secondaryColor: club.color2,
                    players: {
                        create: Array.from({ length: 8 }, (_, i) => ({
                            id: `p-${teamId}-${i}`,
                            name: `${rnd(firstNames)} ${rnd(lastNames)}`,
                            photoUrl: undefined,
                        })),
                    },
                },
            })
            console.log(`✅ Time criado: ${team.name}`)
        }
    }

    console.log('✅ Seed concluído!')
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
