import 'server-only'

/**
 * Boot the online payment adapters. Importing this module registers them.
 * A new gateway adds `import './<id>'` here and calls `registerPaymentMethodAdapter`
 * from its own file. Offline methods are not registered.
 */
import './barion'
import './stripe'
import './paypal'
