'use client';

import { useRouter, useParams } from 'next/navigation';

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-slate-400 hover:text-slate-200 text-sm mb-4 inline-block"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-slate-100">{username}</h1>
      </div>

      {/* Profile Card */}
      <div className="glass rounded-2xl p-8 border border-white/10">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl bg-indigo-900/50 border-3 border-indigo-500"
          >
            👤
          </div>
          <h2 className="text-2xl font-bold text-slate-100">{username}</h2>
          <p className="text-slate-400 text-sm">Player profile</p>
        </div>
      </div>
    </div>
  );
}
