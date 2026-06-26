'use client';

export default function GradientMesh() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-accent/8 rounded-full blur-[120px] animate-drift" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-violet-600/6 rounded-full blur-[100px] animate-drift-slow" />
      <div
        className="absolute bottom-0 left-1/2 w-[500px] h-[300px] bg-indigo-900/10 rounded-full blur-[100px]"
        style={{ animation: 'drift 30s ease-in-out infinite reverse' }}
      />
    </div>
  );
}
