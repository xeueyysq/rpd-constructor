import {createContext, FC, ReactNode} from 'react';
import useAuth from '../../store/useAuth.tsx';
import {AppAbility, buildAbilityFor} from "../../ability/CaslAbility.ts";

type Props = {
    children: ReactNode;
};

const CaslContext = createContext<AppAbility>(
    buildAbilityFor('anonymous')
);

export const CaslProvider: FC<Props> = ({children}) => {
    const {ability} = useAuth();

    return (
        <CaslContext.Provider value={ability}>
            {children}
        </CaslContext.Provider>
    );
};