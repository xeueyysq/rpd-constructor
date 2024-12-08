import {createContext} from 'react';
import {AppAbility} from '../model/types';

export const CaslContext = createContext<AppAbility | null>(null);
