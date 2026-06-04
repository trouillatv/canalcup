"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";

export function PushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    const wasDismissed = localStorage.getItem("push-notif-dismissed") === "true";
    setPermission(Notification.permission);
    setDismissed(wasDismissed);

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
      setReady(true);
    });
  }, []);

  const subscribe = async () => {
    if (!("serviceWorker" in navigator)) return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscription failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("push-notif-dismissed", "true");
    setDismissed(true);
  };

  if (!ready) return null;
  if (dismissed || permission === "denied") return null;
  if (permission === "granted" && isSubscribed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 animate-slide-up">
      <div className="bg-canal-gray border border-canal-gray-light rounded-2xl p-4 flex items-center gap-3 shadow-2xl">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-canal-yellow/10 flex items-center justify-center">
          <Bell size={20} className="text-canal-yellow" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Activer les notifications</p>
          <p className="text-xs text-canal-gray-muted mt-0.5">
            Buts, résultats, alertes en direct
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={subscribe}
            disabled={loading}
            className="px-3 py-1.5 bg-canal-yellow text-black text-xs font-bold rounded-lg disabled:opacity-50"
          >
            {loading ? "…" : "Activer"}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-canal-gray-muted hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
