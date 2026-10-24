import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { UserProvider } from '@/lib/UserContext'
import ChatBox from './components/ChatBox'
import SquadRosterTab from './components/SquadRosterTab'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Doomsday Squad Booking',
  description: 'Group movie ticketing for Avengers: Doomsday',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <UserProvider>
          {children}
          <SquadRosterTab />
          <ChatBox />
        </UserProvider>
      </body>
    </html>
  )
}
