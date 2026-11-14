import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

const DEFAULT_SIZE = 20;

export function Satellite({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M13 7 9 3 5 7l4 4" />
      <path d="m17 11 4 4-4 4-4-4" />
      <path d="m8 12 4 4 6-6-4-4Z" />
      <path d="m16 8 3-3" />
      <path d="M9 21a6 6 0 0 0-6-6" />
    </svg>
  );
}

export function Compass({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

export function Activity({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export function Crosshair({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="22" x2="18" y1="12" y2="12" />
      <line x1="6" x2="2" y1="12" y2="12" />
      <line x1="12" x2="12" y1="6" y2="2" />
      <line x1="12" x2="12" y1="22" y2="18" />
    </svg>
  );
}

export function Radio({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
      <circle cx="12" cy="2" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
      <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
    </svg>
  );
}

export function SettingsIcon({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function Sliders({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="1" x2="7" y1="14" y2="14" />
      <line x1="9" x2="15" y1="8" y2="8" />
      <line x1="17" x2="23" y1="16" y2="16" />
    </svg>
  );
}

export function FileText({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

export function Wifi({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M12 20h.01" />
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M5 12.859a10 10 0 0 1 14 0" />
      <path d="M8.5 16.429a5 5 0 0 1 7 0" />
    </svg>
  );
}

export function WifiOff({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M8.5 16.429a5 5 0 0 1 7 0" />
      <path d="M12 20h.01" />
      <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
      <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.82" />
      <path d="M16.85 11.25a10 10 0 0 1 2.22 1.61" />
      <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
    </svg>
  );
}

export function Key({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="m21 2-2 2m-1.5 1.5L16 7l-1.5-1.5L13 7l-1.5-1.5L10 7" />
      <circle cx="7.5" cy="15.5" r="5.5" />
    </svg>
  );
}

export function Lock({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function RefreshCw({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

export function HomeIcon({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function Clock({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function CheckCircle({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function AlertTriangle({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

export function Play({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export function Pause({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

export function ChevronRight({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function Menu({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

export function X({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function Cpu({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <rect width="16" height="16" x="4" y="4" rx="2" />
      <rect width="6" height="6" x="9" y="9" rx="1" />
      <path d="M15 2v2" /><path d="M15 20v2" />
      <path d="M2 15h2" /><path d="M2 9h2" />
      <path d="M20 15h2" /><path d="M20 9h2" />
      <path d="M9 2v2" /><path d="M9 20v2" />
    </svg>
  );
}

export function Download({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

export function HardDrive({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <line x1="22" x2="2" y1="12" y2="12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="6" x2="6.01" y1="16" y2="16" />
      <line x1="10" x2="10.01" y1="16" y2="16" />
    </svg>
  );
}

export function ChevronDown({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronUp({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function Check({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function Trash2({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

export function Mic({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

export function MicOff({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

export function Volume2({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

export function VolumeX({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" x2="16" y1="9" y2="15" />
      <line x1="16" x2="22" y1="9" y2="15" />
    </svg>
  );
}

export function Sparkles({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      <path d="M5 3v4" />
      <path d="M3 5h4" />
      <path d="M19 17v4" />
      <path d="M17 19h4" />
    </svg>
  );
}

export function StopCircle({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <circle cx="12" cy="12" r="10" />
      <rect width="6" height="6" x="9" y="9" />
    </svg>
  );
}

export function Send({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <line x1="22" x2="11" y1="2" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function Bot({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <rect width="18" height="12" x="3" y="6" rx="2" />
      <path d="M9 14h.01" />
      <path d="M15 14h.01" />
      <path d="M12 6V2" />
      <path d="M2 12h1" />
      <path d="M21 12h1" />
    </svg>
  );
}

export function ExternalLink({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  );
}

export function Search({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function Copy({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function Info({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function Calendar({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function List({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

export function Map({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

export function TrendingUp({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

export function Navigation({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <polygon points="3 11 22 2 13 21 11 13 3 11" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

export function Target({ className = "w-5 h-5", size = DEFAULT_SIZE, width, height, ...props }: IconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ maxWidth: '100%', flexShrink: 0 }} {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
