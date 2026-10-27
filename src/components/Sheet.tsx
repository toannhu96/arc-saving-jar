import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
          <motion.section
            role="dialog"
            aria-label={title}
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-black/10" />
            </div>
            <div className="px-5 pb-8 pt-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="flex size-11 items-center justify-center rounded-full"
                  style={{ color: 'var(--muted)' }}
                >
                  <X className="size-5" />
                </button>
              </div>
              {children}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
