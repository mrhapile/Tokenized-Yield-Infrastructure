import type { Metadata } from 'next'
import './globals.css'
import React from 'react'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { SolanaProvider } from '@/components/providers/solana-provider'

export const metadata: Metadata = {
  title: 'Tokenized Yield Infrastructure',
  description: 'On-Chain Share Issuance & Revenue Distribution Engine',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SolanaProvider>
            {children}
          </SolanaProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
// Patch BigInt so we can log it using JSON.stringify without any errors
declare global {
  interface BigInt {
    toJSON(): string
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString()
}
