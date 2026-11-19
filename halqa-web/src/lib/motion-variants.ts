/** Motion constants + the section-reveal variant factory.
 *
 *  Kept out of lib/motion.tsx (which exports components) so that file stays a
 *  pure component module — otherwise React Fast Refresh drops the whole tree
 *  on every edit. One-line re-export from motion.tsx keeps call sites stable.
 *
 *  Spec §2.3 motion contract — mirrors hero-15 / enter exactly:
 *  hidden {opacity 0, y 16, blur 10} → visible, stagger 0.12s, delay 0.15s,
 *  spring mass 1.2 / stiffness 40 / damping 15. Reduced motion lands on the
 *  final frame: nothing travels, blurs, or scales. */
import type { Variants } from 'motion/react';
import { useReducedMotion } from './useReducedMotion';

export const SPRING = { type: 'spring', mass: 1.2, stiffness: 40, damping: 15 } as const;

const full: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING },
};

const settled: Variants = {
  hidden: { opacity: 1, y: 0, filter: 'none' },
  show: { opacity: 1, y: 0, filter: 'none' },
};

export function useSectionReveal(index = 0) {
  const reduced = useReducedMotion();
  const v = reduced ? settled : full;
  return {
    variants: v,
    initial: 'hidden' as const,
    animate: 'show' as const,
    transition: { ...SPRING, delay: 0.15 + index * 0.12 },
  };
}
