/**
 * Spring physics tokens — all Framer Motion transitions should use these.
 * Design principle: "All transitions use spring curves (damping 25–28, stiffness 220–300).
 * Duration-based easing is a last resort."
 *
 * SPRING_DEFAULT   — panels, canvas, breadcrumbs, general UI
 * SPRING_STANDARD  — dialogs, modals, node lift hover
 * SPRING_SNAPPY    — buttons, CTAs (intentional outlier: faster feel)
 * SPRING_GENTLE    — delayed hints, AI section reveals (softest feel)
 * SPRING_BOUNCE    — copy-success pulse (intentional outlier: satisfying snap)
 * SPRING_BADGE     — small element highlights on hover (intentional outlier)
 */

export const SPRING_DEFAULT = {
  type: "spring" as const,
  damping: 28,
  stiffness: 260,
} as const;

export const SPRING_STANDARD = {
  type: "spring" as const,
  damping: 25,
  stiffness: 300,
} as const;

export const SPRING_SNAPPY = {
  type: "spring" as const,
  damping: 22,
  stiffness: 320,
} as const;

export const SPRING_GENTLE = {
  type: "spring" as const,
  damping: 28,
  stiffness: 220,
} as const;

export const SPRING_BOUNCE = {
  type: "spring" as const,
  damping: 14,
  stiffness: 400,
} as const;

export const SPRING_BADGE = {
  type: "spring" as const,
  damping: 20,
  stiffness: 350,
} as const;
