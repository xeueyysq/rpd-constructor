import {createContext} from 'react'
import {AppAbility} from './types.ts'

export const CaslContext = createContext<AppAbility | null>(null)
