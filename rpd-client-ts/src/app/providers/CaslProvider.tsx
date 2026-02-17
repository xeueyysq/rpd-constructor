import { FC, ReactNode } from "react";
import { useAuth } from "@entities/auth";
import { CaslContext } from "@shared/ability";

type Props = {
  children: ReactNode;
};

const CaslProvider: FC<Props> = ({ children }) => {
  const { ability } = useAuth();

  return (
    <CaslContext.Provider value={ability}>{children}</CaslContext.Provider>
  );
};

export default CaslProvider;
