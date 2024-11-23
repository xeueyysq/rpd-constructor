import {createContext} from 'react';
import {AppAbility, buildAbilityFor} from '../../../ability/CaslAbility.ts';

export const CaslContext = createContext<AppAbility>(
    buildAbilityFor('anonymous')
);
