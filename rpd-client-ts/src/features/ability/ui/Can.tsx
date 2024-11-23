import {createContextualCan} from '@casl/react';
import CaslContext from '../model/CaslContext.ts';

export const Can = createContextualCan(CaslContext.Consumer);