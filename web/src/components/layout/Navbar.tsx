'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTracker } from '@/context/TrackerContext';
import {
  Satellite,
  Compass,
  Radio,
  Sliders,
  FileText,
  Activity,
  Key,
  Lock,
  Wifi,
  WifiOff,
  ChevronDown,
  Menu,
  X
} from '@/components/ui/icons';

const mainNavItems = [
  { name: 'Home', href: '/', icon: Satellite },
  { name: 'Dashboard', href: '/dashboard', icon: Compass },
  { name: 'Control', href: '/control', icon: Radio },
  { name: 'Settings', href: '/settings', icon: Sliders },
];

const moreNavItems = [
  { name: 'Satellite Data', href: '/tle', icon: FileText, desc: 'Update satellite orbital data' },
  { name: 'History', href: '/logs', icon: Activity, desc: 'View past tracking history & download' },
  { name: 'About', href: '/about', icon: Satellite, desc: 'Hardware details & parts' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { connectionStatus, authToken, setTokenModalOpen, status } = useTracker();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isMoreActive = moreNavItems.some((item) => pathname === item.href);

  // Real hardware connection: only true when ESP32 hardwareConnected flag is true
  const hardwareMode = (status as any)?.hardware_mode;
  const hardwareConnected = status?.hardwareConnected === true || hardwareMode === 'HARDWARE_CONNECTED';
  const isMock = hardwareMode === 'MOCK' || hardwareMode === 'SIMULATION' || (!hardwareMode && connectionStatus === 'connected');

  // Close dropdown cleanly when clicking or tapping outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMoreDropdownOpen(false);
      }
    }
    if (moreDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [moreDropdownOpen]);


  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="p-2 rounded-xl bg-sky-50 border border-sky-200/80 text-sky-600 group-hover:bg-sky-100 transition-all shadow-xs">
                <Satellite className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <span className="font-extrabold tracking-tight text-base sm:text-lg text-slate-900 group-hover:text-sky-600 transition-colors">
                  NAVIC<span className="text-sky-500">-TRACK</span>
                </span>
                <span className="hidden sm:block text-[11px] text-slate-500 font-medium">
                  Antenna Tracker
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1.5">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-500'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {/* "More" Dropdown Menu */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isMoreActive
                      ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <span>More</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${moreDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {moreDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 z-50">
                    {moreNavItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreDropdownOpen(false)}
                          className={`flex items-start gap-2.5 px-3.5 py-2.5 text-sm transition-colors cursor-pointer select-none ${
                            isActive
                              ? 'bg-sky-50 text-sky-700 font-medium'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-800">{item.name}</div>
                            <div className="text-xs text-slate-500">{item.desc}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Right Status Indicators & Auth */}
          <div className="flex items-center gap-2.5">
            {/* Live Connection Badge with clear text */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border shadow-2xs ${
                hardwareConnected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isMock
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : connectionStatus === 'connecting'
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {hardwareConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Hardware Live</span>
                </>
              ) : isMock ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <Wifi className="w-3.5 h-3.5 text-amber-600" />
                  <span>Simulation</span>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                  <span>Not Connected</span>
                </>
              )}
            </div>

            {/* Auth Token Button */}
            <button
              onClick={() => setTokenModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-2xs cursor-pointer ${
                authToken
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-700 hover:bg-emerald-100/70'
                  : 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
              }`}
            >
              {authToken ? (
                <>
                  <Key className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Token Set</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-sky-600" />
                  <span>Enter Token</span>
                </>
              )}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center gap-1.5 p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium border border-slate-200"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? (
                <>
                  <X className="w-4 h-4 text-slate-700" />
                  <span>Close</span>
                </>
              ) : (
                <>
                  <Menu className="w-4 h-4 text-slate-700" />
                  <span>Menu</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2 shadow-lg">
          <div className="text-xs font-semibold text-slate-400 px-3 uppercase tracking-wider">Main Pages</div>
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-base font-semibold transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-sky-600' : 'text-slate-500'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          <div className="pt-2 text-xs font-semibold text-slate-400 px-3 uppercase tracking-wider">More Tools</div>
          {moreNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-base font-semibold transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-5 h-5 text-sky-500" />
                <div>
                  <div className="text-slate-900">{item.name}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}