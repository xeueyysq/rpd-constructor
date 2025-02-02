import { createContextualCan } from "@casl/react";
import { CaslContext } from "../model/caslContext.ts";

export const Can = createContextualCan(CaslContext.Consumer);
