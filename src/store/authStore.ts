import { create } from 'zustand'

export type Account = { id: string; email: string; username: string }

/** Who's signed in (null = guest, rooms saved in this browser only). */
export const useAuth = create(() => ({ account: null as Account | null }))
