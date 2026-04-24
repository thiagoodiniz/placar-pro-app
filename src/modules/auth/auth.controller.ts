import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../../lib/prisma'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const JWT_SECRET = process.env.JWT_SECRET || 'secret'

export async function register(req: Request, res: Response) {
    const { name, email, password } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'User already exists' })

    const hashedPassword = await bcrypt.hash(password, 10)
    const userCount = await prisma.user.count()
    
    // First user is always ADMIN
    const role = userCount === 0 ? 'ADMIN' : 'USER'

    const user = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            role: role as any
        }
    })

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
    return res.json({ user, token })
}

export async function login(req: Request, res: Response) {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) return res.status(400).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' })

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
    return res.json({ user, token })
}

export async function googleLogin(req: Request, res: Response) {
    const { token: googleToken } = req.body

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: googleToken,
            audience: process.env.GOOGLE_CLIENT_ID
        })
        const payload = ticket.getPayload()
        if (!payload) return res.status(400).json({ error: 'Invalid token' })

        const { sub, email, name, picture } = payload
        if (!email) return res.status(400).json({ error: 'Email missing' })

        let user = await prisma.user.findUnique({ where: { email } })

        if (!user) {
            const userCount = await prisma.user.count()
            const role = userCount === 0 ? 'ADMIN' : 'USER'
            
            user = await prisma.user.create({
                data: {
                    email,
                    name: name || email,
                    avatarUrl: picture,
                    googleId: sub,
                    role: role as any
                }
            })
        } else if (!user.googleId) {
            user = await prisma.user.update({
                where: { email },
                data: { googleId: sub, avatarUrl: picture }
            })
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
        return res.json({ user, token })
    } catch (error) {
        return res.status(400).json({ error: 'Google login failed' })
    }
}

export async function me(req: Request, res: Response) {
    const userId = (req as any).userId
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    return res.json(user)
}

export async function listUsers(req: Request, res: Response) {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
    })
    return res.json(users)
}

export async function updateUserRole(req: Request, res: Response) {
    const { userId } = req.params
    const { role } = req.body

    const user = await prisma.user.update({
        where: { id: userId as string },
        data: { role: role as any }
    })
    return res.json(user)
}
