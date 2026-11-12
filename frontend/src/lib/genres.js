import { Wand2, Compass, Ghost, MapPin, Rocket, Sparkles } from "lucide-react";

export const GENRE_LIST = [
  { id: "fantasia",       name: "Fantasía",        tagline: "Reinos olvidados y magias antiguas",  color: "#a855f7", soft: "from-purple-600/20 to-indigo-900/0",     Icon: Wand2 },
  { id: "misterio",       name: "Misterio",        tagline: "Pistas entre la niebla",              color: "#d97706", soft: "from-amber-600/20 to-stone-900/0",       Icon: Compass },
  { id: "terror",         name: "Terror",          tagline: "Sombras que susurran",                color: "#dc2626", soft: "from-red-700/20 to-zinc-950/0",          Icon: Ghost },
  { id: "aventura",       name: "Aventura",        tagline: "Expediciones hacia lo desconocido",   color: "#10b981", soft: "from-emerald-600/20 to-teal-950/0",      Icon: MapPin },
  { id: "ciencia_ficcion",name: "Ciencia Ficción", tagline: "Fronteras cósmicas",                  color: "#0284c7", soft: "from-sky-600/25 to-blue-950/0",          Icon: Rocket },
  { id: "infantil",       name: "Infantil",        tagline: "Cuentos tiernos para soñar",          color: "#f59e0b", soft: "from-amber-400/25 to-orange-950/0",      Icon: Sparkles },
];

export const GENRE_BY_ID = Object.fromEntries(GENRE_LIST.map((g) => [g.id, g]));
