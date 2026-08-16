type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}
}

function fileId(value: unknown): string | null {
  const candidate = record(value).fileId
  return typeof candidate === "string" && candidate ? candidate : null
}

export function requiredArtworkFileIds(snapshots: Array<{ snapshot?: unknown }>): string[] {
  const ids = new Set<string>()
  for (const snapshot of snapshots) {
    const configuration = record(record(snapshot.snapshot).configuration)
    const artwork = record(configuration.artwork)
    for (const value of [artwork.front, artwork.back, configuration.neckLabel]) {
      const id = fileId(value)
      if (id) ids.add(id)
    }
  }
  return [...ids]
}

export type ArtworkReviewStatus = "pending" | "approved" | "rejected"

export function aggregateArtworkReviewStatus(statuses: ArtworkReviewStatus[]): ArtworkReviewStatus {
  if (statuses.some((status) => status === "rejected")) return "rejected"
  if (statuses.length > 0 && statuses.every((status) => status === "approved")) return "approved"
  return "pending"
}
