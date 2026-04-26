'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface OnboardingStep {
  targetId: string
  title: string
  content: string
}

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

interface OnboardingProps {
  steps: OnboardingStep[]
}

const SPOTLIGHT_PAD = 8
const CARD_W = 320
const CARD_H_EST = 214
const CARD_GAP = 14
const EDGE_PAD = 12
const STORAGE_KEY = 'gallery_tour_seen'

function readRect(targetId: string): SpotlightRect | null {
  const el = document.getElementById(targetId)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    top: r.top - SPOTLIGHT_PAD,
    left: r.left - SPOTLIGHT_PAD,
    width: r.width + SPOTLIGHT_PAD * 2,
    height: r.height + SPOTLIGHT_PAD * 2,
  }
}

export default function Onboarding({ steps }: OnboardingProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })
  const [stepIndex, setStepIndex] = useState(0)
  const [validSteps, setValidSteps] = useState<OnboardingStep[]>([])
  const [rect, setRect] = useState<SpotlightRect | null>(null)

  useEffect(() => {
    if (dismissed) return
    const valid = steps.filter(s => !!document.getElementById(s.targetId))
    setValidSteps(valid)
    setStepIndex(0)
  }, [steps, dismissed])

  const refreshRect = useCallback(() => {
    const step = validSteps[stepIndex]
    if (!step) { setRect(null); return }
    setRect(readRect(step.targetId))
  }, [validSteps, stepIndex])

  useEffect(() => {
    refreshRect()
    window.addEventListener('resize', refreshRect)
    window.addEventListener('scroll', refreshRect, { passive: true })
    return () => {
      window.removeEventListener('resize', refreshRect)
      window.removeEventListener('scroll', refreshRect)
    }
  }, [refreshRect])

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
  }, [])

  const advance = useCallback(() => {
    if (stepIndex >= validSteps.length - 1) {
      dismiss()
    } else {
      setStepIndex(i => i + 1)
    }
  }, [stepIndex, validSteps.length, dismiss])

  if (dismissed || validSteps.length === 0) return null

  const step = validSteps[stepIndex]
  if (!step) return null

  const isLast = stepIndex === validSteps.length - 1
  const total = validSteps.length

  // ── Card placement ──────────────────────────────────────────────────────────
  let cardStyle: React.CSSProperties = { width: CARD_W }
  if (rect && typeof window !== 'undefined') {
    const vw = window.innerWidth
    const vh = window.innerHeight

    const belowStart = rect.top + rect.height + CARD_GAP
    const aboveStart = rect.top - CARD_GAP - CARD_H_EST

    let top: number
    if (belowStart + CARD_H_EST + EDGE_PAD <= vh) {
      top = belowStart
    } else if (aboveStart >= EDGE_PAD) {
      top = aboveStart
    } else {
      top = Math.max(EDGE_PAD, vh - CARD_H_EST - EDGE_PAD)
    }

    const centeredLeft = rect.left + rect.width / 2 - CARD_W / 2
    const left = Math.min(Math.max(centeredLeft, EDGE_PAD), vw - CARD_W - EDGE_PAD)
    cardStyle = { width: CARD_W, top, left }
  }
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
      {/* Full-screen backdrop — click outside to skip */}
      <div className="absolute inset-0 cursor-default" onClick={dismiss} />

      {/* Spotlight cutout */}
      {rect && (
        <motion.div
          className="absolute z-10 pointer-events-none rounded-[12px]"
          style={{
            boxShadow: '0 0 0 9999px rgba(27, 46, 38, 0.54)',
            backdropFilter: 'blur(1.5px)',
          }}
          animate={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
          transition={{ type: 'spring', stiffness: 290, damping: 30, mass: 0.9 }}
        />
      )}

      {/* Tour card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          className="absolute z-20 pointer-events-auto bg-[#F9F8F6] rounded-2xl border border-gray-200/80 shadow-2xl px-6 py-5"
          style={cardStyle}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Progress row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className={`block h-[3px] rounded-full transition-all duration-300 ${
                    i < stepIndex
                      ? 'w-2 bg-[#1B2E26]/30'
                      : i === stepIndex
                      ? 'w-5 bg-[#1B2E26]'
                      : 'w-2 bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] text-gray-400 font-sans tabular-nums">
              {stepIndex + 1}&thinsp;/&thinsp;{total}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-serif text-[#1B2E26] text-[17px] font-semibold leading-snug mb-1.5 tracking-[-0.01em]">
            {step.title}
          </h3>

          {/* Body */}
          <p className="font-sans text-[13px] text-gray-500 leading-relaxed mb-5">
            {step.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={dismiss}
              className="shrink-0 font-sans text-[12px] text-gray-400 hover:text-gray-500 transition-colors underline underline-offset-2 decoration-gray-300"
            >
              跳過導覽
            </button>
            <button
              onClick={advance}
              className="flex-1 font-sans text-[13px] font-medium bg-[#1B2E26] text-white rounded-xl py-2.5 hover:bg-[#263f32] active:scale-[0.97] transition-all duration-150 shadow-sm"
            >
              {isLast ? '完成' : '下一步 →'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
