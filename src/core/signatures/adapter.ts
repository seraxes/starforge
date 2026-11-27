import { createNoopSignatureProvider } from './noop'
import type { SignatureFactoryOptions, SignatureProvider } from './types'

/**
 * Serializable signature provider. Safe to list in env / admin pickers.
 */
export type SignatureAdapterDescriptor = {
  id: string
  label: string
}

export type SignatureAdapter = SignatureAdapterDescriptor & {
  createProvider: () => SignatureProvider
}

const SITE_PROVIDERS = new Set(['noop'])

const adapters = new Map<string, SignatureAdapter>()

export function registerSignatureAdapter(adapter: SignatureAdapter): void {
  const id = adapter.id.trim().toLowerCase()
  if (!id || SITE_PROVIDERS.has(id)) {
    throw new Error(`Signature adapter id "${adapter.id}" is reserved`)
  }
  adapters.set(id, { ...adapter, id })
}

export function getSignatureAdapter(id: string): SignatureAdapter | undefined {
  return adapters.get(id.trim().toLowerCase())
}

export function listSignatureAdapters(): SignatureAdapter[] {
  return [...adapters.values()]
}

export function listSignatureAdapterDescriptors(): SignatureAdapterDescriptor[] {
  return listSignatureAdapters().map(({ id, label }) => ({ id, label }))
}

export function listOnlineSignatureProviderIds(): string[] {
  return listSignatureAdapters().map((adapter) => adapter.id)
}

export function isOnlineSignatureProvider(value: unknown): value is string {
  return typeof value === 'string' && (SITE_PROVIDERS.has(value) || adapters.has(value))
}

/** Site/dev provider picker: noop, then registered providers. */
export function listOnlineSignatureProviders(): Array<{ value: string; label: string }> {
  return [
    { value: 'noop', label: 'Noop (dev)' },
    ...listSignatureAdapterDescriptors().map((descriptor) => ({
      value: descriptor.id,
      label: descriptor.label,
    })),
  ]
}

/** Environment editor choices for `SF_SIGNATURES_PROVIDER`. */
export function signaturesProviderEnvOptions(): Array<{ value: string; label: string }> {
  return [{ value: '', label: '(unset — noop)' }, ...listOnlineSignatureProviders()]
}

/**
 * Build a SignatureProvider from explicit options (tests / site config).
 * Online ids resolve through the registry. `noop` stays the site/dev provider.
 */
export function createSignatureProvider(options: SignatureFactoryOptions): SignatureProvider {
  if (!options.enabled) return createNoopSignatureProvider()
  if (options.provider === 'noop') return createNoopSignatureProvider()
  const adapter = adapters.get(options.provider.trim().toLowerCase())
  if (adapter) return adapter.createProvider()
  return createNoopSignatureProvider()
}

export function getSignatureProvider(override?: string): SignatureProvider {
  const raw =
    (override || process.env.SF_SIGNATURES_PROVIDER || 'noop').trim() || 'noop'
  const provider = isOnlineSignatureProvider(raw) ? raw : 'noop'
  return createSignatureProvider({ provider, enabled: true })
}
