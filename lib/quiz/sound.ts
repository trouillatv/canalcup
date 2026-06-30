// Sons du quiz show — synthétisés via Web Audio (aucun fichier asset à charger).
// UNIQUEMENT pour l'écran TV maître (/quiz-show) : un seul haut-parleur pilote
// la salle. Les téléphones restent muets (sinon cacophonie).
//
// Autoplay : un AudioContext démarre "suspended" tant qu'aucun geste utilisateur
// n'a eu lieu. L'animateur clique une fois sur « 🔊 » → initAudio() le débloque.

let ctx: AudioContext | null = null;

export function initAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function audioReady(): boolean {
  return !!ctx && ctx.state === "running";
}

// Une note simple avec enveloppe (attack rapide, release exponentiel).
function tone(freq: number, dur: number, type: OscillatorType = "sine", peak = 0.22, delay = 0): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.connect(g);
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

export const sfx = {
  // Démarrage de question : balayage montant énergique.
  whoosh(): void {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(110, t0);
    o.frequency.exponentialRampToValueAtTime(880, t0 + 0.22);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.34);
  },
  // Tic du compte à rebours ; `level` (0→4) fait monter la tension.
  tick(level = 0): void {
    tone(620 + level * 90, 0.07, "square", 0.18);
  },
  // Fin du temps : buzzer grave un peu dissonant.
  buzzer(): void {
    tone(150, 0.45, "sawtooth", 0.26);
    tone(159, 0.45, "sawtooth", 0.18);
  },
  // Apparition des barres de répartition.
  reveal(): void {
    tone(523, 0.1, "triangle", 0.18);
    tone(784, 0.16, "triangle", 0.18, 0.09);
  },
  // Bonne réponse : arpège majeur ascendant (do-mi-sol-do).
  correct(): void {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.24, "triangle", 0.2, i * 0.075));
  },
  // Classement / mouvement positif : petit "up".
  rankUp(): void {
    tone(660, 0.1, "triangle", 0.18);
    tone(990, 0.16, "triangle", 0.18, 0.08);
  },
  // Fanfare de fin / podium.
  fanfare(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.38, "triangle", 0.2, i * 0.11));
  },
};
