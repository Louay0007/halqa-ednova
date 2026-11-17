import { motion, type Variants } from 'motion/react';
import { useReducedMotion } from '../lib/useReducedMotion';

/** Spec §2.3 motion contract — mirrors hero-15 / enter exactly:
 *  hidden {opacity 0, y 16, blur 10} → visible, stagger 0.12s, delay 0.15s,
 *  spring mass 1.2 / stiffness 40 / damping 15. Reduced motion lands on the
 *  final frame: nothing travels, blurs, or scales. */

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

/** Convenience wrapper: a spring-revealed section, nth child = `index`. */
export function Reveal({
  index = 0,
  as = 'section',
  className,
  children,
}: {
  index?: number;
  as?: 'section' | 'article' | 'div' | 'header' | 'footer';
  className?: string;
  children?: React.ReactNode;
}) {
  const props = useSectionReveal(index);
  const M = motion[as] as typeof motion.div;
  return (
    <M className={className} {...props}>
      {children}
    </M>
  );
}

export { motion };
