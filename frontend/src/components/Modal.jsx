/**
 * Modal.jsx
 * ─────────
 * Reusable modal dialog built on a focus-trapped overlay.
 *
 * Props:
 *   isOpen    (bool)        — controls visibility
 *   onClose   (fn)          — called when overlay/Escape is clicked
 *   title     (string)      — header text
 *   size      (sm|md|lg)    — width preset, default "md"
 *   children               — modal body content
 *
 * Usage:
 *   <Modal isOpen={show} onClose={() => setShow(false)} title="Create User">
 *     <form>…</form>
 *   </Modal>
 */

import { useEffect } from 'react';

const SIZE_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ isOpen, onClose, title, size = 'md', children }) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative bg-gray-900 border border-gray-700 rounded-2xl
                    shadow-2xl w-full ${SIZE_MAP[size] || SIZE_MAP.md}
                    max-h-[90vh] flex flex-col`}
        style={{ animation: 'modalIn 0.15s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4
                        border-b border-gray-800 flex-shrink-0">
          <h3 className="text-white font-semibold text-lg">{title}</h3>
          <button
            id="modal-close"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl
                       w-8 h-8 flex items-center justify-center rounded-lg
                       hover:bg-gray-800"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}
