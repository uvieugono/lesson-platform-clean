import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './theme-context'; // Import ThemeProvider
import { AppWrapper } from './AppWrapper'; // Import AppWrapper

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider> {/* Wrap children with ThemeProvider */}
          <AppWrapper>{children}</AppWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
