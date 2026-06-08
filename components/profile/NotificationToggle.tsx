"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function NotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const canUsePush = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(canUsePush);
    setPermission(canUsePush ? Notification.permission : "denied");

    if (!canUsePush) {
      setLoading(false);
      return;
    }

    navigator.serviceWorker.ready
      .then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        setEnabled(!!subscription);
      })
      .catch(() => setError("Notifications indisponibles sur cet appareil."))
      .finally(() => setLoading(false));
  }, []);

  const enableNotifications = async () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError("Configuration notifications manquante.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setError("Autorisation refusee dans le navigateur.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) throw new Error("subscribe_failed");
      localStorage.removeItem("push-notif-dismissed");
      setEnabled(true);
    } catch {
      setError("Activation impossible pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  const disableNotifications = async () => {
    setLoading(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }

      localStorage.setItem("push-notif-dismissed", "true");
      setEnabled(false);
    } catch {
      setError("Desactivation impossible pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    if (!supported || loading || permission === "denied") return;
    if (enabled) void disableNotifications();
    else void enableNotifications();
  };

  const disabled = !supported || loading || permission === "denied";
  const status = !supported
    ? "Non disponible sur ce navigateur"
    : permission === "denied"
      ? "Bloquees dans les reglages du navigateur"
      : enabled
        ? "Activees sur cet appareil"
        : "Desactivees sur cet appareil";

  return (
    <section className="canal-card" aria-labelledby="notifications-heading">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            enabled ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-canal-gray-muted"
          )}
          aria-hidden
        >
          {enabled ? <Bell size={18} /> : <BellOff size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="notifications-heading"
            className="text-xs text-canal-yellow font-bold uppercase tracking-wider"
          >
            Notifications
          </h2>
          <p className="text-sm text-white font-bold mt-0.5">Alertes Canal Cup</p>
          <p className="text-xs text-canal-gray-muted mt-0.5">{status}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={disabled}
          onClick={toggle}
          className={cn(
            "relative h-8 w-14 rounded-full border transition-colors disabled:opacity-50",
            enabled
              ? "border-canal-yellow bg-canal-yellow"
              : "border-canal-gray-light bg-canal-gray-mid"
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-6 w-6 rounded-full transition-transform",
              enabled ? "bg-canal-black translate-x-6" : "bg-canal-gray-muted translate-x-1"
            )}
          />
        </button>
      </div>
      {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
    </section>
  );
}
