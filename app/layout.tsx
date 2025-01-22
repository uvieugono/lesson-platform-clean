import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './theme-context'; // Import ThemeProvider
import { AppWrapper } from './AppWrapper'; // Import AppWrapper
import 'react-toastify/dist/ReactToastify.css'; // Import CSS for toast notifications
import { ToastContainer } from 'react-toastify'; // Import ToastContainer

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
          <AppWrapper>
            <ToastContainer /> {/* Add ToastContainer */}
            {children}
          </AppWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
