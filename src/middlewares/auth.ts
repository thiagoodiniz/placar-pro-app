import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'secret'

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' })
    }

    const [, token] = authHeader.split(' ')

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string, role: string }
        ;(req as any).userId = decoded.id
        ;(req as any).userRole = decoded.role
        return next()
    } catch (err) {
        return res.status(401).json({ error: 'Token invalid' })
    }
}

export function roleMiddleware(roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = (req as any).userRole

        if (!roles.includes(userRole)) {
            return res.status(403).json({ error: 'Permission denied' })
        }

        return next()
    }
}
