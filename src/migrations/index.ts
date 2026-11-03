import * as migration_20261103_005622_baseline from './20261103_005622_baseline';
import * as migration_20261103_181356_pages_tags_taxonomy from './20261103_181356_pages_tags_taxonomy';

export const migrations = [
  {
    up: migration_20261103_005622_baseline.up,
    down: migration_20261103_005622_baseline.down,
    name: '20261103_005622_baseline',
  },
  {
    up: migration_20261103_181356_pages_tags_taxonomy.up,
    down: migration_20261103_181356_pages_tags_taxonomy.down,
    name: '20261103_181356_pages_tags_taxonomy'
  },
];
