import 'server-only'

/**
 * Boot the online signature adapters. Importing this module registers them.
 * A new provider adds `import './<id>'` here and calls `registerSignatureAdapter`
 * from its own file.
 */
import './docusign'
