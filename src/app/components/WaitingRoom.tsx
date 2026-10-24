"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function WaitingRoom({ appState }: { appState: Record<string, unknown> | null }) {
  const [status, setStatus] = useState<"pending" | "approved" | null>(null);

  useEffect(() => {
    // In a real app with auth, we'd fetch the user's status based on their session.
    // For this mockup, we'll try to find the most recently created user on this IP/device if no real auth exists.
    // Given the prompt didn't specify user login for the waiting room, we'll fetch a mock user status,
    // or you could use localStorage to save the created user ID and fetch that.

    const storedUserId = localStorage.getItem("doomsday_user_id");
    if (storedUserId) {
      supabase.from("users").select("payment_status").eq("id", storedUserId).single().then(({ data }) => {
        if (data) setStatus(data.payment_status as "pending" | "approved");
      });
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 pt-12 flex flex-col items-center justify-center min-h-[80vh] space-y-12">

      {/* Personal Status Banner */}
      <div className={`w-full max-w-2xl border p-6 rounded-xl text-center ${status === 'approved' ? 'bg-green-950/30 border-green-500/50 text-green-400' : 'bg-amber-950/30 border-amber-500/50 text-amber-400'}`}>
        <h2 className="text-2xl font-bold mb-2 uppercase tracking-wide">Status: {status === 'approved' ? 'Approved' : 'Pending Verification'}</h2>
        {status === 'approved' ? (
          <p>You&apos;re locked in! Seat booking opens once voting closes. Set your alarm—first to claim gets the best spot.</p>
        ) : (
          <p>Receipt received! Admin is verifying the funds. Once approved, you&apos;ll be greenlit for the seat scramble.</p>
        )}
      </div>

      {/* Global Countdown Card */}
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 p-8 rounded-xl text-center">
        <h3 className="text-xl text-neutral-400 mb-6 uppercase tracking-widest">Mission Status</h3>
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
            <div className="text-sm text-neutral-500 mb-1">Winning Date</div>
            <div className="text-2xl font-bold text-white">{String(appState?.winning_date || 'TBD')}</div>
          </div>
          <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
            <div className="text-sm text-neutral-500 mb-1">Seats Secured</div>
            <div className="text-2xl font-bold text-white">TBD</div>
          </div>
        </div>

        <div className="border-t border-neutral-800 pt-8">
          <div className="text-sm text-neutral-500 mb-4 uppercase tracking-widest">Countdown to Seat Scramble</div>
          <div className="text-5xl font-mono font-bold text-green-500 tracking-tighter">
            SOON
          </div>
        </div>
      </div>

    </div>
  );
}
