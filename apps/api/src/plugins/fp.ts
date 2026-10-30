/**
 * Tiny local fastify-plugin shim so we avoid an extra dependency
 * while still marking the auth plugin as encapsulated correctly.
 */
import type { FastifyPluginAsync, FastifyPluginCallback } from "fastify";

type Plugin = FastifyPluginAsync | FastifyPluginCallback;

export default function fp<T extends Plugin>(
  plugin: T,
  opts?: { name?: string },
): T {
  Object.defineProperty(plugin, Symbol.for("skip-override"), {
    value: true,
  });
  if (opts?.name) {
    Object.defineProperty(plugin, Symbol.for("fastify.display-name"), {
      value: opts.name,
    });
  }
  return plugin;
}
