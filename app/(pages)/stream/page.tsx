'use client'

import { StreamChat } from '@organisms/StreamChat'
import { PageLayout } from '@organisms'

export default function StreamPage() {
  return (
    <PageLayout title="A3 Example — Streaming">
      <StreamChat />
    </PageLayout>
  )
}
