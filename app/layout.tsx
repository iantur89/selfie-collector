import type { Metadata } from 'next'
import { ThemeProvider } from './ThemeProvider'

export const metadata: Metadata = {
  title: 'A3 Core Example',
  description: 'Example application for @genui-a3/core',
  icons: [
    { rel: 'icon', url: '/favicon.ico', type: 'image/x-icon', sizes: '32x32', media: '(prefers-color-scheme: light)' },
    {
      rel: 'icon',
      url: '/favicon-dark.ico',
      type: 'image/x-icon',
      sizes: '32x32',
      media: '(prefers-color-scheme: dark)',
    },
    { rel: 'icon', url: '/icon.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
    { rel: 'icon', url: '/icon.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
    { rel: 'apple-touch-icon', url: '/apple-icon.png', media: '(prefers-color-scheme: light)' },
    { rel: 'apple-touch-icon', url: '/apple-icon-dark.png', media: '(prefers-color-scheme: dark)' },
  ],
  manifest: '/site.webmanifest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
