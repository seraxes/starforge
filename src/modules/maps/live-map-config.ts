export type LiveMapParticleConfig = {
  roomId: string
  heading: string
  height: string
}

export const defaultLiveMapConfig: LiveMapParticleConfig = {
  roomId: '',
  heading: '',
  height: '24rem',
}

export function readLiveMapConfig(raw: unknown): LiveMapParticleConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    roomId: typeof obj.roomId === 'string' ? obj.roomId.trim() : '',
    heading: typeof obj.heading === 'string' ? obj.heading : '',
    height:
      typeof obj.height === 'string' && obj.height.trim()
        ? obj.height.trim()
        : defaultLiveMapConfig.height,
  }
}
