import type { Metadata } from 'next';
import './globals.css';
import { TrackerProvider } from '@/context/TrackerContext';
import { Navbar } from '@/components/layout/Navbar';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { TokenModal } from '@/components/layout/TokenModal';
import { WelcomeBanner } from '@/components/layout/WelcomeBanner';
import { JarvisAssistant } from '@/components/jarvis/JarvisAssistant';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'NAVIC-TRACK | Satellite Antenna Tracker',
  description: 'Simple and autonomous satellite antenna tracker for NavIC and other satellites',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#f0f4f9] text-slate-800 antialiased font-sans selection:bg-sky-500/20 selection:text-sky-900">
        <TrackerProvider>
          <OfflineBanner />
          <WelcomeBanner />
          <Navbar />
          <TokenModal />
          <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3 flex flex-col">
            {children}
          </main>
          <JarvisAssistant />
          <footer className="border-t border-slate-200/80 bg-white mt-auto py-2.5 sm:py-3 text-center text-xs text-slate-500">
            <div className="w-full max-w-[1600px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="font-medium text-slate-600">NAVIC-TRACK &bull; Autonomous 2-Axis Satellite Tracker</div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <Link href="/about" className="text-sky-600 hover:text-sky-700 underline">
                  About & Hardware Specs
                </Link>
                <Link href="/settings" className="text-slate-500 hover:text-slate-800">
                  Settings
                </Link>
              </div>
            </div>
          </footer>
        </TrackerProvider>
      </body>
    </html>
  );
}
