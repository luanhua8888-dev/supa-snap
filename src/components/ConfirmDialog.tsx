import { motion } from 'framer-motion';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={isLoading ? undefined : onCancel} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-xs bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-pink-100/30 dark:border-zinc-800"
      >
        <h3 className="font-rounded font-extrabold text-lg text-slate-800 dark:text-pink-100">
          {title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">{message}</p>
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl text-sm font-bold font-rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl text-sm font-bold font-rounded bg-rose-500 hover:bg-rose-600 text-white cursor-pointer disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
