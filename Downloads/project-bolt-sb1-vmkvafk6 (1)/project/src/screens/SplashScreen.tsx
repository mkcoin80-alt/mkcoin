import { useEffect } from 'react';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 bg-yellow-400 flex flex-col items-center justify-center z-50 select-none">
      <div className="flex flex-col items-center gap-5 animate-[splashFade_0.6s_ease-out]">
        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-2xl">
          <span className="text-4xl font-black text-yellow-400 tracking-tight">MK</span>
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-black text-white tracking-wide">MK Coin</h1>
          <p className="text-yellow-100 text-sm font-medium mt-1">Your Finance Platform</p>
        </div>
      </div>
      <div className="absolute bottom-16 flex gap-2">
        <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-white/70 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
