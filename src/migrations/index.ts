import * as migration_20261103_005622_baseline from './20261103_005622_baseline';
import * as migration_20261103_181356_pages_tags_taxonomy from './20261103_181356_pages_tags_taxonomy';
import * as migration_20261103_media_tags_sf148 from './20261103_media_tags_sf148';
import * as migration_20261103_media_categories_phase2 from './20261103_media_categories_phase2';
import * as migration_20261103_locked_docs_categories_heal from './20261103_locked_docs_categories_heal';
import * as migration_20261105_site_settings_performance_heal from './20261105_site_settings_performance_heal';
import * as migration_20261105_site_settings_dashboard_knobs from './20261105_site_settings_dashboard_knobs';
import * as migration_20261105_site_settings_select_heal from './20261105_site_settings_select_heal';

export const migrations = [
  {
    up: migration_20261103_005622_baseline.up,
    down: migration_20261103_005622_baseline.down,
    name: '20261103_005622_baseline',
  },
  {
    up: migration_20261103_181356_pages_tags_taxonomy.up,
    down: migration_20261103_181356_pages_tags_taxonomy.down,
    name: '20261103_181356_pages_tags_taxonomy',
  },
  {
    up: migration_20261103_media_tags_sf148.up,
    down: migration_20261103_media_tags_sf148.down,
    name: '20261103_media_tags_sf148',
  },
  {
    up: migration_20261103_media_categories_phase2.up,
    down: migration_20261103_media_categories_phase2.down,
    name: '20261103_media_categories_phase2',
  },
  {
    up: migration_20261103_locked_docs_categories_heal.up,
    down: migration_20261103_locked_docs_categories_heal.down,
    name: '20261103_locked_docs_categories_heal',
  },
  {
    up: migration_20261105_site_settings_performance_heal.up,
    down: migration_20261105_site_settings_performance_heal.down,
    name: '20261105_site_settings_performance_heal',
  },
  {
    up: migration_20261105_site_settings_dashboard_knobs.up,
    down: migration_20261105_site_settings_dashboard_knobs.down,
    name: '20261105_site_settings_dashboard_knobs',
  },
  {
    up: migration_20261105_site_settings_select_heal.up,
    down: migration_20261105_site_settings_select_heal.down,
    name: '20261105_site_settings_select_heal',
  },
];
