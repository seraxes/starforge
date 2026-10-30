/**
 * Starforge core public surface.
 * Feature modules (auth, users, jobs, …) should export through here over time.
 */
export { auth } from './auth'
export { db, pool, sfUsers, sfSessions, sfAccounts, sfVerifications } from './db'
