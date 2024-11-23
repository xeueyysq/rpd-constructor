import {createContext} from 'react';
import {buildAbilityFor} from '../lib/buildAbilityFor.ts';
import {AppAbility} from "./types.ts";

export const CaslContext = createContext<AppAbility>(
    buildAbilityFor('anonymous')
);
