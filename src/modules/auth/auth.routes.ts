import { Router } from 'express'
import * as AuthController from './auth.controller'
import { authMiddleware, roleMiddleware } from '../../middlewares/auth'

const routes = Router()

routes.post('/register', AuthController.register)
routes.post('/login', AuthController.login)
routes.post('/google', AuthController.googleLogin)

routes.get('/me', authMiddleware, AuthController.me)

// User Management (Admin only)
routes.get('/users', authMiddleware, roleMiddleware(['ADMIN']), AuthController.listUsers)
routes.patch('/users/:userId/role', authMiddleware, roleMiddleware(['ADMIN']), AuthController.updateUserRole)

export { routes as authRoutes }
