import React, { useState } from 'react';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { NotificationItem, UserProfile } from '../types/repairloop';
import { formatTimestamp, markNotificationRead } from '../services/firestoreService';

export interface NavItem {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}

interface DashboardShellProps {
  user: UserProfile;
  navItems: NavItem[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  notifications: NotificationItem[];
  onSignOut: () => void;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<UserProfile['role'], string> = {
  customer: 'Customer Workspace',
  mechanic: 'Mechanic Workspace',
  vendor: 'Vendor Workspace',
};

export const DashboardShell: React.FC<DashboardShellProps> = ({
  user,
  navItems,
  activeTab,
  onSelectTab,
  notifications,
  onSignOut,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeItem = navItems.find((n) => n.id === activeTab);

  const renderNavContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 h-16 flex items-center border-b border-navy-800">
        <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
          RepairLoop
        </span>
      </div>

      <div className="px-5 py-4 border-b border-navy-800">
        <div className="text-xs font-medium text-teal-400">
          {ROLE_LABELS[user.role]}
        </div>
        <div className="text-sm font-semibold text-white truncate mt-0.5">
          {user.fullName}
        </div>
        <div className="text-xs text-slate-400 truncate">{user.email}</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.Icon;
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-300 hover:bg-navy-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                <span
                  className={`font-mono text-xs tabular-nums ${
                    isActive ? 'text-white' : 'text-teal-300'
                  }`}
                >
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-navy-800">
        <button
          type="button"
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-navy-800 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 bg-navy-950 shrink-0 sticky top-0 h-screen">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-navy-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-navy-950 h-full z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            {renderNavContent()}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 h-16 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 text-slate-600 hover:text-navy-950 rounded-lg border border-slate-200 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 hidden sm:inline">
                {ROLE_LABELS[user.role]}
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-navy-950 truncate">
                {activeItem?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative">
            <button
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-label="Toggle notifications"
              className="relative inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Notifications</span>
              {unreadCount > 0 && (
                <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums">
                  ({unreadCount})
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-navy-950">
                    Notifications
                  </span>
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No notifications yet. Activity updates appear here.
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <div
                        key={n.id}
                        className={`p-3.5 text-left ${
                          n.read ? 'bg-white' : 'bg-teal-50/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-semibold text-navy-950">
                            {n.title}
                          </div>
                          <span className="text-[11px] text-slate-400 whitespace-nowrap">
                            {formatTimestamp(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {n.message}
                        </p>
                        {!n.read && n.id && (
                          <button
                            type="button"
                            onClick={() => markNotificationRead(n.id!)}
                            className="mt-2 text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
