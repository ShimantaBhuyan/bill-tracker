import { X } from "lucide-react";
import { api } from "../api";

interface Props {
  filename: string;
  onClose: () => void;
}

export function ImageZoomOverlay({ filename, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      <img
        src={api.imageUrl(filename)}
        alt={filename}
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/40">
        {filename} · Click anywhere or press Escape to close
      </p>
    </div>
  );
}
