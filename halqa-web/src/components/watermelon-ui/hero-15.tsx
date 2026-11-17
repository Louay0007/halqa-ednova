import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import LogoIcon from '../../assets/logo-icon';

/**
 * Vendored from https://registry.watermelon.sh/r/hero-15.json (shadcn registry).
 * Adapted rather than installed: this repo has no `@/` alias, no components.json
 * and no cva, so the CLI would have scaffolded a second design system. Layout,
 * motion and type scale are the registry's; colour, copy and assets are HALQA's.
 */

export interface NavLinkItem {
  label: string;
  to: string;
}

export interface ProofPoint {
  value: string;
  label: string;
}

interface Hero15Props {
  brandName?: string;
  navLinks?: NavLinkItem[];
  navExtra?: ReactNode;
  headingLine1: string;
  headingLine2: string;
  description: string;
  primaryCtaLabel: string;
  primaryCtaTo: string;
  secondaryCtaLabel: string;
  secondaryCtaTo: string;
  signupLabel: string;
  signupTo: string;
  proofEyebrow: string;
  proofs: ProofPoint[];
  footnote?: ReactNode;
  backgroundImage?: string;
}

const sectionVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const softReveal: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985, filter: 'blur(12px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring', mass: 1.2, stiffness: 40, damping: 15 },
  },
};

const navReveal: Variants = {
  hidden: { opacity: 0, y: -12, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', mass: 1, stiffness: 50, damping: 12 },
  },
};

const proofReveal: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.94, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring', mass: 0.8, stiffness: 60, damping: 12 },
  },
};

const imageVariants: Variants = {
  hidden: { opacity: 0, scale: 1.05, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring', mass: 1.5, stiffness: 30, damping: 20 },
  },
};

function NavTarget({
  link,
  className,
  children,
}: {
  link: NavLinkItem;
  className: string;
  children?: ReactNode;
}) {
  if (link.to.startsWith('/')) {
    return (
      <Link to={link.to} className={className}>
        {children ?? link.label}
      </Link>
    );
  }
  return (
    <a href={link.to} className={className}>
      {children ?? link.label}
    </a>
  );
}

export default function Hero15({
  brandName = 'HALQA',
  navLinks = [],
  navExtra,
  headingLine1,
  headingLine2,
  description,
  primaryCtaLabel,
  primaryCtaTo,
  secondaryCtaLabel,
  secondaryCtaTo,
  signupLabel,
  signupTo,
  proofEyebrow,
  proofs,
  footnote,
  backgroundImage = '/hero-bg.avif',
}: Hero15Props) {
  const reduce = useReducedMotion();
  // Reduced motion: start on the final frame so nothing travels, blur or scales.
  const from = reduce ? 'visible' : 'hidden';

  const pill =
    'inline-flex min-h-10 items-center justify-center rounded-md bg-paper px-6 text-sm font-normal text-navy shadow-[inset_0_2px_0_0_rgba(255,255,255,1),inset_0_-1px_0_0_rgba(0,0,0,0.2)] transition-[background-color,color,transform] duration-200 ease-out text-shadow-2xs hover:bg-gray-200 hover:text-ink active:scale-[0.96]';

  return (
    <section className="relative isolate flex min-h-dvh w-full overflow-hidden bg-navy-deep px-1.5 py-1.5 text-white antialiased">
      <motion.div
        className="relative flex w-full min-h-0 flex-col overflow-hidden bg-navy-deep shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
        initial={from}
        whileInView="visible"
        viewport={{ once: true, amount: 0.38 }}
        variants={sectionVariants}
      >
        <motion.img
          variants={imageVariants}
          src={backgroundImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <motion.nav
          variants={navReveal}
          aria-label="HALQA"
          className="relative z-10 mx-auto flex min-h-12 w-full max-w-7xl items-center justify-between gap-4 px-6 py-3 sm:px-12 lg:px-24"
        >
          <Link
            to="/"
            className="inline-flex min-h-10 items-center gap-2 text-base font-semibold text-white/92 transition-[opacity,transform] duration-200 ease-out hover:opacity-80 active:scale-[0.96]"
          >
            <LogoIcon className="size-8" />
            <span translate="no">{brandName}</span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {navLinks.map((link) => (
              <NavTarget
                key={link.label}
                link={link}
                className="inline-flex min-h-10 items-center text-sm font-normal text-white/84 transition-[color,transform] duration-200 ease-out hover:text-white active:scale-[0.96]"
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {navExtra}
            <Link to={signupTo} className={pill}>
              {signupLabel}
            </Link>
          </div>
        </motion.nav>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-6 pt-16 pb-10 text-center sm:px-12 sm:pt-20 lg:px-24">
          <motion.div variants={softReveal} className="mx-auto max-w-4xl 2xl:max-w-7xl">
            <h1 className="text-[clamp(2.9rem,6.1vw,6.55rem)] leading-[0.98] font-light tracking-normal text-balance text-white/95">
              <span className="block">{headingLine1}</span>
              <span className="mt-1 block font-serif text-[1.06em] leading-[0.92] font-normal text-white italic">
                {headingLine2}
              </span>
            </h1>
          </motion.div>

          <motion.p
            variants={softReveal}
            className="mt-5 max-w-lg text-sm leading-7 font-normal text-pretty text-white/70 2xl:text-lg"
          >
            {description}
          </motion.p>

          <motion.div variants={softReveal} className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to={primaryCtaTo} className={`${pill} min-h-11`}>
              {primaryCtaLabel}
            </Link>
            <Link
              to={secondaryCtaTo}
              className="group/secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white/10 px-5 text-sm font-light text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_14px_34px_rgba(0,0,0,0.18)] backdrop-blur-md transition-[background-color,transform,box-shadow] duration-200 ease-out hover:bg-aqua/20 hover:shadow-[inset_0_0_0_1px_rgba(30,167,161,0.45),0_18px_42px_rgba(0,0,0,0.26)] active:scale-[0.96]"
            >
              {secondaryCtaLabel}
              <ArrowRight className="size-3.5 transition-transform duration-200 ease-out group-hover/secondary:translate-x-0.5 rtl:rotate-180 rtl:group-hover/secondary:-translate-x-0.5" />
            </Link>
          </motion.div>

          <motion.div
            variants={sectionVariants}
            initial={from}
            whileInView="visible"
            viewport={{ once: true, amount: 0.8 }}
            className="mt-auto w-full pt-14 sm:pb-20"
          >
            <motion.p variants={softReveal} className="text-sm font-light text-white/50 2xl:text-lg">
              {proofEyebrow}
            </motion.p>
            <div className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-x-10 gap-y-5">
              {proofs.map((proof) => (
                <motion.div key={proof.label} variants={proofReveal} className="flex items-baseline gap-2.5">
                  <span className="text-3xl font-medium tracking-[-0.02em] text-white/90 tnum 2xl:text-4xl">
                    {proof.value}
                  </span>
                  <span className="max-w-28 text-start text-xs leading-4 text-white/45">{proof.label}</span>
                </motion.div>
              ))}
            </div>

            {footnote && (
              <motion.p variants={softReveal} className="mx-auto mt-8 max-w-2xl text-xs leading-5 text-white/35">
                {footnote}
              </motion.p>
            )}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
