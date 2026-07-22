// src/components/notifications/NotificationBell.tsx
//
// Real notification bell + dropdown feed, shown in the shared Header for
// every logged-in user (admin or employee). Backed by
// src/services/notification/notificationService.ts.

import { useEffect, useRef, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadMyNotifications, markMyNotificationRead } from '../../services/notification/notificationService';
import type { EmployeeNotification } from '../../types/notification';

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-slate-300',
  normal: 'bg-blue-400',
  high: 'bg-amber-400',
  urgent: 'bg-red-500',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function IconBell({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}

function NotificationBell() {
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<EmployeeNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  function fetchNotifications() {
    if (!user?.id) return;
    setLoading(true);
    loadMyNotifications(user.id)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const unreadCount = items.filter((i) => i.recipient.read_status === 'unread').length;

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) fetchNotifications();
  }

  async function handleItemClick(item: EmployeeNotification) {
    if (item.recipient.read_status === 'unread') {
      setItems((prev) => prev.map((i) => (i.recipient.id === item.recipient.id ? { ...i, recipient: { ...i.recipient, read_status: 'read' } } : i)));
      try {
        await markMyNotificationRead(item.recipient.id);
      } catch {
        // best-effort — local state already updated for a snappy feel
      }
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={handleOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100/70 text-slate-500 transition hover:bg-slate-200"
      >
        <IconBell />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">Notifications</p>
            {unreadCount > 0 && <span className="text-xs font-medium text-indigo-600">{unreadCount} unread</span>}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-slate-400">
                <IconBell className="h-8 w-8 text-slate-200" />
                <p className="text-sm font-medium">You're all caught up.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.recipient.id}>
                    <button
                      onClick={() => handleItemClick(item)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${item.recipient.read_status === 'unread' ? 'bg-indigo-50/40' : ''}`}
                    >
                      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${item.recipient.read_status === 'unread' ? (PRIORITY_DOT[item.notification.priority] ?? 'bg-blue-400') : 'bg-transparent'}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm ${item.recipient.read_status === 'unread' ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                          {item.notification.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.notification.message}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{timeAgo(item.notification.created_at)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
