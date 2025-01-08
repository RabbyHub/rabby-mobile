import {
  GET_SERVICE_BY_NAME,
  MIGRATABLE_STORE_SERVICE,
} from '@/core/storage/storeConstant';
import {
  preferenceStoreMigration,
  preferenceServiceMigration,
} from './preference.migration';
import { IServiceMigrationsByVersion } from './_fns';

export const storeMigrations = {
  preferenceStoreMigration,
};

export const serviceMigrations: {
  [P in MIGRATABLE_STORE_SERVICE]?: IServiceMigrationsByVersion<
    GET_SERVICE_BY_NAME<P>
  >;
} = {
  preference: preferenceServiceMigration,
};
