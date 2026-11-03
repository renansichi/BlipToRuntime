// Ingestao (F1-01..03): arquivo .7z / pasta, manifesto e hashes, envelopes, JSON sem perda.
export { extractArchive, isSafeRelativePath, DEFAULT_ARCHIVE_LIMITS, ArchiveError } from './archive.js'
export type { ArchiveLimits } from './archive.js'
export { parseLossless, stringifyLossless, deepEqual, toNumber, isLosslessNumber } from './lossless.js'
export { readPackage, sha256Hex } from './package.js'
export type { BotSource, SourcePackage, ConfigEntry, FileRef, Json, JsonObject } from './package.js'
