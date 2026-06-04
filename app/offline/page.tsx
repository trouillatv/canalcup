export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <img src="/icons/icon-192.png" alt="Canal Cup" className="w-20 h-20 rounded-2xl" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Pas de connexion</h1>
        <p className="text-sm text-canal-gray-muted max-w-xs">
          Reconnectez-vous à Internet pour accéder à Canal Cup.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-canal-yellow text-black font-bold rounded-xl text-sm"
      >
        Réessayer
      </button>
    </div>
  );
}
