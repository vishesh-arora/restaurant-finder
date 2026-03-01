import './globals.css'

export const metadata = {
  title: 'Restaurant Finder',
  description: 'Find the best restaurants for any occasion',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
