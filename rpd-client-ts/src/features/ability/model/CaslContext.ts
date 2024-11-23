import {createContext} from 'react';
import {AppAbility, buildAbilityFor} from '../../../ability/CaslAbility.ts';

const CaslContext = createContext<AppAbility>(
    buildAbilityFor('anonymous')
);

export default CaslContext;