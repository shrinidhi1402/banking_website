import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import * as auth from '../controllers/authController.js'
import * as customer from '../controllers/customerController.js'
import * as ops from '../controllers/operationsController.js'
import * as bugs from '../controllers/bugController.js'

const router = Router()
router.post('/auth/login', auth.login)
router.post('/auth/verify-otp', auth.verifyOtp)
router.post('/auth/resend-otp', auth.resendOtp)
router.use(authenticate)
router.post('/auth/logout', auth.logout)
router.get('/auth/me', auth.me)

const customerRouter = Router(); customerRouter.use(requireRole('CUSTOMER'))
customerRouter.get('/profile', customer.profile).put('/profile', customer.updateProfile).get('/account', customer.account).get('/transactions', customer.transactions).get('/beneficiaries', customer.beneficiaries).post('/beneficiaries', customer.addBeneficiary).delete('/beneficiaries/:id', customer.deleteBeneficiary).post('/transfer', customer.transfer).put('/password', customer.password)
router.use('/customer', customerRouter)

const employeeRouter = Router(); employeeRouter.use(requireRole('EMPLOYEE', 'MANAGER'))
employeeRouter.get('/dashboard', ops.employeeDashboard).get('/customers', ops.employeeCustomers).post('/customers', ops.createCustomer).get('/customers/:id', ops.employeeCustomer).get('/transactions', ops.employeeTransactions).get('/transactions/:id', ops.employeeTransaction).get('/requests', ops.employeeRequests).put('/requests/:id', ops.decideRequest).get('/profile', ops.employeeProfile).put('/profile', ops.updateOwnProfile).put('/password', customer.password)
router.use('/employee', employeeRouter)

const managerRouter = Router(); managerRouter.use(requireRole('MANAGER'))
managerRouter.get('/dashboard', ops.reports).get('/customers', ops.managerCustomers).get('/customers/:id', ops.managerCustomer).put('/customers/:id/status', ops.customerStatus).get('/employees', ops.managerEmployees).post('/employees', ops.createEmployee).get('/employees/:id', ops.managerEmployee).put('/employees/:id', ops.updateEmployee).put('/employees/:id/status', ops.employeeStatus).get('/transactions/suspicious', ops.suspiciousTransactions).get('/transactions', ops.managerTransactions).get('/transactions/:id', ops.managerTransaction).get('/requests', ops.managerRequests).put('/requests/:id', ops.decideRequest).get('/security-events', ops.securityEvents).get('/reports', ops.reports).get('/profile', ops.managerProfile).put('/profile', ops.updateOwnProfile).put('/password', customer.password)
router.use('/manager', managerRouter)

// ─── Bug Lab Routes ─────────────────────────────────────────────────────────────
const bugRouter = Router()

// Phase 4 – Insider Threat (Requires EMPLOYEE or MANAGER role)
bugRouter.get('/insider-threat', requireRole('EMPLOYEE', 'MANAGER'), bugs.insiderThreat)

// Phase 5 – Client-Side Secret Exposure (Accessible to all authenticated roles)
bugRouter.get('/secret', bugs.secretExposure)

// Flags state (Accessible to all authenticated roles for client-side simulations)
bugRouter.get('/flags', bugs.getFlags)

// Phase 0-3 – Flag management and simulations (Manager only)
const managerBugRouter = Router(); managerBugRouter.use(requireRole('MANAGER'))
managerBugRouter.post('/toggle',                    bugs.toggle)
managerBugRouter.post('/trigger/mfa-bypass',        bugs.triggerMfaBypass)
managerBugRouter.post('/trigger/supply-chain',      bugs.triggerSupplyChain)   // Phase 6
managerBugRouter.post('/trigger/pam-jump-server',   bugs.triggerPamJumpServer) // Phase 7
managerBugRouter.post('/search',                    bugs.sqlSearch)
managerBugRouter.get('/account',                    bugs.idorAccount)
managerBugRouter.get('/accounts/list',              bugs.idorListAccounts)
bugRouter.use(managerBugRouter)
router.use('/bugs', bugRouter)

export default router

