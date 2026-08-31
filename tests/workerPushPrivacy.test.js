import { describe, expect, it } from 'vitest'
import { dailyCheckPush, restockPush } from '../worker/src/domain/schedule.js'
import { missedDosePush } from '../worker/src/domain/escalation.js'

// Guardrail G3 / task #7: no push notification body may contain a medicine name.
// Every outbound push path uses one of these generic builders; the specifics live
// only in the in-app alert fetched over the authenticated API.

describe('no PII in push copy', () => {
  it('never contains a medicine name in any scheduled or escalation push', () => {
    const names = ['metformin', 'insulin', 'aspirin', 'warfarin', 'amoxicillin']
    const messages = [dailyCheckPush(), restockPush(), missedDosePush('Level 1'), missedDosePush('Level 2')]
    for (const message of messages) {
      const text = `${message.title} ${message.body}`.toLowerCase()
      for (const name of names) expect(text).not.toContain(name)
    }
  })
})
