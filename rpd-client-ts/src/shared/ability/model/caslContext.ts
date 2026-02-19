import { createContext } from "react";
import { AppAbility } from "./types.ts";
import { buildAbilityFor } from "../lib/buildAbilityFor.ts";
import { UserRole } from "./enums.ts";

export const CaslContext = createContext<AppAbility>(
  buildAbilityFor(UserRole.ANONYMOUS)
);
