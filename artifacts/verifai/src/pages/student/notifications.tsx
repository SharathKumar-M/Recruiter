import { useEffect, useState, useCallback } from "react";
import { Bell, CheckCircle2, Clock3, ExternalLink, ShieldCheck, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { toast } from "sonner";

interface NotificationItem {
  id: number;
  studentId: number;
  notificationType: string;
  title: string;
  message: string;
  relatedId?: number;
  read: boolean;
  createdAt: string;
}

export default function StudentNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await fetch("/api/student/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      setNotifications(data);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/student/notifications/${id}/read`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to update notification");
      setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      toast.error("Could not update notification status");
    }
  };

  const markAllRead = async () => {
    try {
      await Promise.all(
        notifications
          .filter((n) => !n.read)
          .map((n) => fetch(`/api/student/notifications/${n.id}/read`, { method: "PATCH" }))
      );
      setNotifications(notifications.map((n) => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-8 space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Activity stream</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">Notifications</h2>
          <p className="mt-1 text-sm text-slate-600">Stay updated on your applications, recruiter reviews, and platform messages.</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="rounded-xl border-slate-200">
            Mark all as read
          </Button>
        )}
      </section>

      {isError && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex gap-3 p-4 text-sm text-amber-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Failed to load notifications</p>
              <p className="text-xs mt-0.5">Please check your connection and try refreshing.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((item) => (
            <Card
              key={item.id}
              className={`border-slate-200/80 shadow-sm rounded-2xl transition-all bg-white ${
                !item.read ? "border-l-4 border-l-indigo-600 bg-indigo-50/20" : ""
              }`}
            >
              <CardContent className="p-5 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-950 text-base">{item.title}</h3>
                    {!item.read && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.message}</p>
                  <p className="text-xs text-slate-400 pt-1 flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" /> {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge variant="secondary" className="capitalize text-[10px] bg-slate-100 text-slate-700">
                    {item.notificationType.replace("_", " ")}
                  </Badge>
                  {!item.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(item.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 h-7 px-2"
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-slate-200 rounded-2xl bg-white shadow-none">
          <CardContent className="p-12 text-center">
            <Bell className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-900">No notifications yet</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              When employers review your applications or send updates, they will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
