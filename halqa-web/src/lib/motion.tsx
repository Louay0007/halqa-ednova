import { motion } from 'motion/react';
import { useSectionReveal } from './motion-variants';

/** Reveal wrapper: a spring-revealed section, nth child = `index`.
 *  The variants + useSectionReveal hook live in motion-variants.ts so this
 *  module only exports components (Fast Refresh keeps state across edits).
 *  Call sites keep importing { Reveal, useSectionReveal } from here. */
export { useSectionReveal } from './motion-variants';

/** Convenience wrapper: a spring-revealed section, nth child = `index`. */
export function Reveal({
  index = 0,
  as = 'section',
  className,
  children,
}: {
  index?: number;
  as?: 'section' | 'article' | 'div' | 'header' | 'footer' | 'form' | 'fieldset';
  className?: string;
  children?: React.ReactNode;
}) {
  const props = useSectionReveal(index);
  const M = (motion as unknown as Record<string, typeof motion.div>)[as] as typeof motion.div;
  return (
    <M className={className} {...props}>
      {children}
    </M>
  );
}
