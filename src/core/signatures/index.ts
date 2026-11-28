import 'server-only'

import './register-online'
import { createNoopSignatureProvider } from './noop'

export {
  createSignatureProvider,
  getSignatureAdapter,
  getSignatureProvider,
  isOnlineSignatureProvider,
  listOnlineSignatureProviderIds,
  listOnlineSignatureProviders,
  listSignatureAdapterDescriptors,
  listSignatureAdapters,
  registerSignatureAdapter,
  signaturesProviderEnvOptions,
} from './adapter'
export type { SignatureAdapter, SignatureAdapterDescriptor } from './adapter'
export { createNoopSignatureProvider } from './noop'
export { createDocusignSignatureProvider } from './docusign'
export type {
  CreateSignatureEnvelopeInput,
  CreateSignatureEnvelopeResult,
  DownloadSignedPdfResult,
  SignatureEnvelopeStatus,
  SignatureFactoryOptions,
  SignatureProvider,
  SignatureProviderInfo,
  SignatureStatusResult,
} from './types'
