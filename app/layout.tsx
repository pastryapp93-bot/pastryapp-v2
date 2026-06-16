import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PastryApp — Aux Mille Saveurs',
  description: 'Gestion pâtisserie & boulangerie',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PastryApp',
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon:  '/icon-512.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#C17F24',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="default"/>
        <meta name="apple-mobile-web-app-title" content="PastryApp"/>
        <meta name="mobile-web-app-capable" content="yes"/>
      </head>
      <body>{children}</body>
    </html>
  )
}
