import React, { useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAcademic } from '../context/AcademicContext';

export function NotificationsPage() {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } =
    useAcademic();
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const visible = useMemo(
    () => (tab === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [notifications, tab],
  );

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread alert${unreadCount === 1 ? '' : 's'} requiring attention`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white border border-[#D3D1CE]">
              <button
                type="button"
                onClick={() => setTab('all')}
                className={`min-h-[44px] sm:min-h-[36px] px-3 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  tab === 'all' ? 'bg-[#0F223A] text-white' : 'text-[#262E36]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTab('unread')}
                className={`min-h-[44px] sm:min-h-[36px] px-3 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  tab === 'unread' ? 'bg-[#0F223A] text-white' : 'text-[#262E36]'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-xs font-medium text-[#1C1C1C] hover:border-[#2F466F] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        }
      />

      <div className="luxury-card rounded-xl divide-y divide-[#EDEAE6]">
        {visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#262E36]">
            No unread notifications remaining.
          </div>
        ) : (
          visible.map((item) => (
            <div
              key={item.id}
              className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                item.read ? 'opacity-75' : ''
              }`}
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-[#536878]">
                  <span className="font-medium text-[#2F466F] capitalize">{item.severity}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.timestamp}</span>
                  {!item.read && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#0F223A]">Unread</span>
                    </>
                  )}
                </div>
                <h2 className="mt-1 text-sm font-semibold text-[#0A0A0A]">{item.title}</h2>
                <p className="mt-0.5 text-xs text-[#262E36]">{item.description}</p>
              </div>
              {!item.read && (
                <button
                  type="button"
                  onClick={() => markNotificationRead(item.id)}
                  className="self-start sm:self-center min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#1C1C1C] hover:border-[#2F466F] whitespace-nowrap cursor-pointer"
                >
                  Mark Read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
