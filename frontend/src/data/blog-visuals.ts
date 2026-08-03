import { ShieldCheck, Cpu, Landmark, Briefcase } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const TAG_VISUALS: Record<string, { icon: LucideIcon; bg: string }> = {
  Compliance: { icon: ShieldCheck, bg: 'bg-gradient-to-br from-blue-500 via-indigo-500 to-indigo-700' },
  Technology: { icon: Cpu, bg: 'bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-700' },
  Tax: { icon: Landmark, bg: 'bg-gradient-to-br from-fuchsia-500 via-violet-500 to-purple-700' },
  Business: { icon: Briefcase, bg: 'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-700' },
};

export function getTagVisual(tag: string) {
  return TAG_VISUALS[tag] ?? TAG_VISUALS.Business;
}
