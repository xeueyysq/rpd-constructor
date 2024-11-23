import {createContext} from 'react';
import {buildAbilityFor} from '../lib/utils';
import {AppAbility} from "../lib/types";

export const CaslContext = createContext<AppAbility>(
    buildAbilityFor('anonymous')
);
