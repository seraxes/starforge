import * as migration_20261103_005622_baseline from './20261103_005622_baseline';

export const migrations = [
  {
    up: migration_20261103_005622_baseline.up,
    down: migration_20261103_005622_baseline.down,
    name: '20261103_005622_baseline'
  },
];
