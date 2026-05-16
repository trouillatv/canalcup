// Configuration des chaînes Canal+/beIN — identité visuelle

export interface ChannelConfig {
  name: string;
  shortName: string;
  color: string;        // Tailwind bg color
  textColor: string;    // Tailwind text color
  borderColor: string;  // Tailwind border color
  emoji: string;
  brand: "canal" | "bein" | "other";
}

const CHANNEL_MAP: Record<string, ChannelConfig> = {
  "Canal+ Sport": {
    name: "Canal+ Sport",
    shortName: "C+ Sport",
    color: "bg-canal-yellow",
    textColor: "text-canal-black",
    borderColor: "border-canal-yellow",
    emoji: "📺",
    brand: "canal",
  },
  "Canal+": {
    name: "Canal+",
    shortName: "Canal+",
    color: "bg-canal-yellow",
    textColor: "text-canal-black",
    borderColor: "border-canal-yellow",
    emoji: "📺",
    brand: "canal",
  },
  "beIN Sports 1": {
    name: "beIN Sports 1",
    shortName: "beIN 1",
    color: "bg-red-700",
    textColor: "text-white",
    borderColor: "border-red-600",
    emoji: "📡",
    brand: "bein",
  },
  "beIN Sports 2": {
    name: "beIN Sports 2",
    shortName: "beIN 2",
    color: "bg-red-800",
    textColor: "text-white",
    borderColor: "border-red-700",
    emoji: "📡",
    brand: "bein",
  },
  "beIN Sports 3": {
    name: "beIN Sports 3",
    shortName: "beIN 3",
    color: "bg-red-900",
    textColor: "text-white",
    borderColor: "border-red-800",
    emoji: "📡",
    brand: "bein",
  },
};

const DEFAULT_CHANNEL: ChannelConfig = {
  name: "TV",
  shortName: "TV",
  color: "bg-canal-gray-light",
  textColor: "text-white",
  borderColor: "border-canal-gray-light",
  emoji: "📺",
  brand: "other",
};

export function getChannelConfig(channelName: string): ChannelConfig {
  // Lookup exact, puis partiel
  if (CHANNEL_MAP[channelName]) return CHANNEL_MAP[channelName];
  const partial = Object.keys(CHANNEL_MAP).find((k) =>
    channelName.toLowerCase().includes(k.toLowerCase())
  );
  return partial ? CHANNEL_MAP[partial] : DEFAULT_CHANNEL;
}

export function isCanal(channelName: string): boolean {
  return getChannelConfig(channelName).brand === "canal";
}
