import type { ReactNode } from 'react';

export type IconName =
  | 'dashboard'
  | 'users'
  | 'chat'
  | 'phone'
  | 'transfer'
  | 'send'
  | 'minus'
  | 'close'
  | 'check'
  | 'warning'
  | 'info'
  | 'logout';

const paths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.2 2.8-4.8 5.5-4.8s4.9 1.6 5.5 4.8" />
      <circle cx="17.2" cy="9" r="2.6" />
      <path d="M15.8 14.8c2.5.2 4.2 1.7 4.7 4.4" />
    </>
  ),
  chat: (
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-5 5v-5H6.5A2.5 2.5 0 0 1 4 15.5z" />
  ),
  phone: (
    <path d="M7.5 4h2l1 3-1.5 1.5a12 12 0 0 0 5 5l1.6-1.5 3 1v2a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4 7.5 2 2 0 0 1 7.5 4z" />
  ),
  transfer: (
    <>
      <path d="M4.5 8.5h12" />
      <path d="M12.5 5.5l3 3-3 3" />
      <path d="M19.5 15.5h-12" />
      <path d="M11.5 18.5l-3-3 3-3" />
    </>
  ),
  send: (
    <>
      <path d="M3.5 11.5L19 4.5l-6.5 15-2.5-6-6-2z" />
      <path d="M10 13.5L19 4.5" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  warning: (
    <>
      <path d="M12 4L2.5 20h19z" />
      <path d="M12 10.5v4" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11.5v4.5" />
      <circle cx="12" cy="8.2" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  logout: (
    <>
      <path d="M13 8.5h5.5v7H13" />
      <path d="M8 12h10.5" />
      <path d="M13 6H7A1.5 1.5 0 0 0 5.5 7.5v9A1.5 1.5 0 0 0 7 18h6" />
    </>
  ),
};

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
