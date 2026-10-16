/**
 * Toast.jsx
 * ─────────
 * Lightweight toast notification system — no external library needed.
 *
 * Usage:
 *   import { useToast, ToastContainer } from '../components/Toast';
 *
 *   // In a parent layout (renders the toasts):
 *   <ToastContainer />
 *
 *   // In any child component:
 *   const toast = useToast();
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 *   toast.info('Loading data…');
 */

import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /** Add a toast. Auto-removes after `duration` ms (default 4s). */
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    info:    (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast portal — fixed bottom-right */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Individual toast item */
function Toast({ toast, onClose }) {
  const styles = {
    success: 'bg-emerald-900 border-emerald-700 text-emerald-200',
    error:   'bg-red-900   border-red-700   text-red-200',
    info:    'bg-gray-800  border-gray-600  text-gray-200',
  };

  const icons = { success: '✓', error: '✕', info: 'ℹ' };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3
        rounded-xl border shadow-xl text-sm font-medium max-w-sm
        animate-in slide-in-from-right-4 ${styles[toast.type]}`}
      style={{ animation: 'slideIn 0.2s ease-out' }}
    >
      <span className="text-base">{icons[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onClose}
        className="opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

/** Hook to access toast functions from any component */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
