import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

export type EntranceVariant = 'whirl' | 'cascade' | 'flip' | 'zoom' | 'slide' | 'scatter';

const VARIANTS: EntranceVariant[] = ['whirl', 'cascade', 'flip', 'zoom', 'slide', 'scatter'];
const MAX_STAGGER_INDEX = 18;
const STAGGER_STEP = 0.036;

export function useFeedEntrance(itemCount: number, isReady: boolean, loadTick: number) {
  const [play, setPlay] = useState(false);
  const [variant, setVariant] = useState<EntranceVariant>('whirl');

  useEffect(() => {
    if (!isReady || itemCount === 0 || loadTick === 0) {
      setPlay(false);
      return;
    }
    const pick = VARIANTS[Math.floor(Math.random() * VARIANTS.length)]!;
    setVariant(pick);
    setPlay(true);
  }, [isReady, itemCount, loadTick]);

  return { play, variant };
}

function staggerDelay(index: number) {
  return Math.min(index, MAX_STAGGER_INDEX) * STAGGER_STEP;
}

function spiralCustom(index: number, total: number) {
  const t = total <= 1 ? 0 : index / (total - 1);
  const angle = t * Math.PI * 4;
  const radius = 28 + (1 - t) * 32;
  return { angle, radius, index };
}

type ItemCustom = { index: number; angle?: number; radius?: number; side?: number };

function getGridItemVariants(variant: EntranceVariant): Variants {
  switch (variant) {
    case 'cascade':
      return {
        hidden: () => ({
          opacity: 0,
          y: 28,
          scale: 0.92,
        }),
        visible: (c: ItemCustom) => ({
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { delay: staggerDelay(c.index), type: 'spring', stiffness: 300, damping: 26 },
        }),
      };
    case 'flip':
      return {
        hidden: (c: ItemCustom) => ({
          opacity: 0,
          rotateY: 88,
          scale: 0.7,
          x: c.index % 2 === 0 ? -40 : 40,
        }),
        visible: (c: ItemCustom) => ({
          opacity: 1,
          rotateY: 0,
          scale: 1,
          x: 0,
          transition: { delay: staggerDelay(c.index), type: 'spring', stiffness: 280, damping: 24 },
        }),
      };
    case 'zoom':
      return {
        hidden: { opacity: 0, scale: 1.12 },
        visible: (c: ItemCustom) => ({
          opacity: 1,
          scale: 1,
          transition: { delay: staggerDelay(c.index), type: 'spring', stiffness: 360, damping: 28 },
        }),
      };
    case 'slide':
      return {
        hidden: (c: ItemCustom) => ({
          opacity: 0,
          x: c.index % 2 === 0 ? -36 : 36,
          rotate: c.index % 2 === 0 ? -4 : 4,
        }),
        visible: (c: ItemCustom) => ({
          opacity: 1,
          x: 0,
          rotate: 0,
          transition: { delay: staggerDelay(c.index), type: 'spring', stiffness: 320, damping: 26 },
        }),
      };
    case 'scatter':
      return {
        hidden: (c: ItemCustom) => {
          const side = c.index % 4;
          const offsets = [
            { x: -32, y: 24 },
            { x: 32, y: 20 },
            { x: -28, y: 28 },
            { x: 30, y: 26 },
          ];
          const o = offsets[side]!;
          return { opacity: 0, x: o.x, y: o.y, scale: 0.5, rotate: side * 18 - 27 };
        },
        visible: (c: ItemCustom) => ({
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotate: 0,
          transition: { delay: staggerDelay(c.index), type: 'spring', stiffness: 340, damping: 25 },
        }),
      };
    case 'whirl':
    default:
      return {
        hidden: (c: ItemCustom) => {
          const angle = c.angle ?? 0;
          const radius = c.radius ?? 100;
          return {
            opacity: 0,
            scale: 0.12,
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            rotate: (angle * 180) / Math.PI + 90,
          };
        },
        visible: (c: ItemCustom) => ({
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          rotate: 0,
          transition: { delay: staggerDelay(c.index), type: 'spring', stiffness: 340, damping: 26 },
        }),
      };
  }
}

function getListItemVariants(variant: EntranceVariant): Variants {
  switch (variant) {
    case 'flip':
      return {
        hidden: { opacity: 0, rotateX: -35, y: 30 },
        visible: (i: number) => ({
          opacity: 1,
          rotateX: 0,
          y: 0,
          transition: { delay: staggerDelay(i), type: 'spring', stiffness: 260, damping: 26 },
        }),
      };
    case 'zoom':
      return {
        hidden: { opacity: 0, scale: 0.6 },
        visible: (i: number) => ({
          opacity: 1,
          scale: 1,
          transition: { delay: staggerDelay(i), type: 'spring', stiffness: 300, damping: 28 },
        }),
      };
    case 'slide':
      return {
        hidden: { opacity: 0, x: 80 },
        visible: (i: number) => ({
          opacity: 1,
          x: 0,
          transition: { delay: staggerDelay(i), type: 'spring', stiffness: 300, damping: 28 },
        }),
      };
    case 'scatter':
      return {
        hidden: (i: number) => ({
          opacity: 0,
          x: i % 2 === 0 ? -60 : 60,
          y: 40,
          rotate: i % 2 === 0 ? -6 : 6,
        }),
        visible: (i: number) => ({
          opacity: 1,
          x: 0,
          y: 0,
          rotate: 0,
          transition: { delay: staggerDelay(i), type: 'spring', stiffness: 280, damping: 26 },
        }),
      };
    case 'cascade':
    case 'whirl':
    default:
      return {
        hidden: { opacity: 0, y: 56, scale: 0.94, rotateX: 10 },
        visible: (i: number) => ({
          opacity: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          transition: { delay: staggerDelay(i), type: 'spring', stiffness: 280, damping: 28 },
        }),
      };
  }
}

const containerVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { delayChildren: 0.06, staggerChildren: STAGGER_STEP } },
};

interface FeedEntranceGridProps {
  play: boolean;
  variant: EntranceVariant;
  className?: string;
  children: ReactNode;
}

export function FeedEntranceGrid({ play, variant, className, children }: FeedEntranceGridProps) {
  const reduceMotion = useReducedMotion();
  if (!play || reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      style={{ perspective: variant === 'flip' ? 800 : 700, isolation: 'isolate' }}
    >
      {children}
    </motion.div>
  );
}

interface FeedEntranceCellProps {
  play: boolean;
  variant: EntranceVariant;
  index: number;
  total: number;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

export function FeedEntranceCell({
  play,
  variant,
  index,
  total,
  className,
  children,
  onClick,
}: FeedEntranceCellProps) {
  const reduceMotion = useReducedMotion();
  const itemVariants = getGridItemVariants(variant);
  const custom: ItemCustom =
    variant === 'whirl' ? spiralCustom(index, total) : { index };

  if (!play || reduceMotion) {
    return (
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClick} className={className}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      custom={custom}
      variants={itemVariants}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${className ?? ''} overflow-hidden`}
      style={{ transformOrigin: 'center center', contain: 'layout paint' }}
    >
      {children}
    </motion.div>
  );
}

interface FeedEntranceListProps {
  play: boolean;
  variant: EntranceVariant;
  className?: string;
  children: ReactNode;
}

export function FeedEntranceList({ play, className, children }: FeedEntranceListProps) {
  const reduceMotion = useReducedMotion();
  if (!play || reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      style={{ perspective: 1100 }}
    >
      {children}
    </motion.div>
  );
}

interface FeedEntranceListItemProps {
  play: boolean;
  variant: EntranceVariant;
  index: number;
  children: ReactNode;
}

export function FeedEntranceListItem({ play, variant, index, children }: FeedEntranceListItemProps) {
  const reduceMotion = useReducedMotion();
  const itemVariants = getListItemVariants(variant);

  if (!play || reduceMotion) return <div>{children}</div>;

  return (
    <motion.div variants={itemVariants} custom={index} style={{ transformOrigin: 'center top' }}>
      {children}
    </motion.div>
  );
}

const revealByVariant: Record<EntranceVariant, { opacity: number; y?: number; x?: number; scale?: number; rotate?: number; rotateX?: number }> = {
  whirl: { opacity: 0, y: -20, scale: 0.96 },
  cascade: { opacity: 0, y: 28, scale: 0.98 },
  flip: { opacity: 0, rotateX: 20 },
  zoom: { opacity: 0, scale: 1.08 },
  slide: { opacity: 0, x: -36 },
  scatter: { opacity: 0, x: 24, y: -16, rotate: 4 },
};

interface FeedEntranceRevealProps {
  play: boolean;
  variant: EntranceVariant;
  children: ReactNode;
  className?: string;
}

export function FeedEntranceReveal({ play, variant, children, className }: FeedEntranceRevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={play && !reduceMotion ? { ...revealByVariant[variant] } : false}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1, rotate: 0, rotateX: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.04 }}
    >
      {children}
    </motion.div>
  );
}

export function CinematicFeedLoader({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center py-28 space-y-5 ${className ?? ''}`}>
      <div className="vortex-loader" aria-hidden>
        <div className="vortex-loader-ring" />
        <div className="vortex-loader-ring vortex-loader-ring--delay" />
        <div className="vortex-loader-core" />
      </div>
      <motion.p
        initial={{ opacity: 0.4 }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        className="text-xs text-threads-muted font-medium tracking-wide"
      >
        Đang tải feed…
      </motion.p>
    </div>
  );
}
