import {
  classificationAt,
  classificationKeys,
  classificationMemberships,
  needsReview
} from '../protocol/classification.ts'
import { type ReportMetadata, profilesFor } from '../protocol/report.ts'

export function summarizeClassifications(metadata: ReportMetadata) {
  return {
    runId: metadata.run.runId,
    classificationVersion: metadata.classificationVersion,
    profiles: Object.fromEntries(
      profilesFor(metadata.run).map(profile => {
        const counts = Object.fromEntries(
          classificationKeys.map(id => [id, { total: 0, review: 0 }])
        )

        for (let i = 0; i < metadata.counts[profile]; i++) {
          const value = classificationAt(metadata.classifications[profile], i)
          const review = needsReview(value)
          const ids = classificationMemberships(value)

          for (const id of ids) {
            counts[id].total++
            if (review) counts[id].review++
          }
        }

        return [profile, counts]
      })
    )
  }
}
