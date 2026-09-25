import { FC, ReactNode } from "react";
import { AbilityProvider } from "@casl/react";
import { useAuth } from "@entities/auth";

type Props = {
  children: ReactNode;
};

const CaslProvider: FC<Props> = ({ children }) => {
  const { ability } = useAuth();

  return <AbilityProvider value={ability}>{children}</AbilityProvider>;
};

export default CaslProvider;
