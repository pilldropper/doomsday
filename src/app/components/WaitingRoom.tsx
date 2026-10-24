"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/UserContext";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";

export default function WaitingRoom({
  appState,
}: {
  appState: Record<string, unknown> | null;
}) {
  const { user } = useUser();
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [seatCount, setSeatCount] = useState<number>(0);

  useEffect(() => {
    async function fetchCounts() {
      const [usersRes, seatsRes] = await Promise.all([
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "approved"),
        supabase
          .from("seats")
          .select("id", { count: "exact", head: true })
          .in("status", ["available", "occupied"]),
      ]);
      if (usersRes.count !== null) setApprovedCount(usersRes.count);
      if (seatsRes.count !== null) setSeatCount(seatsRes.count);
    }
    fetchCounts();

    const channel = supabase
      .channel("public:waiting_room")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        fetchCounts
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seats" },
        fetchCounts
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isApproved = user?.payment_status === "approved";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-14 flex flex-col items-center justify-center space-y-8">
      {/* Personal Clearance Banner */}
      <div
        className={`w-full border p-6 rounded-2xl text-center space-y-2 ${
          isApproved
            ? "bg-green-950/20 border-green-500/40 text-green-400"
            : "bg-amber-950/20 border-amber-500/40 text-amber-400"
        }`}
      >
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest">
          {isApproved ? (
            <>
              <CheckCircle2 className="w-4 h-4" /> Clearance: Approved
            </>
          ) : (
            <>
              <Clock className="w-4 h-4" /> Clearance: Pending Verification
            </>
          )}
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          {isApproved
            ? "You're cleared for the Seat Scramble"
            : "Verifying your ticket transfer"}
        </h2>
        <p className="text-xs sm:text-sm text-neutral-300 max-w-xl mx-auto">
          {isApproved
            ? "Stand by! As soon as the admin opens the grid, this screen will automatically switch to the live theater map."
            : "Your receipt is in the queue. Once verified by admin, your clearance will automatically update to Approved."}
        </p>
      </div>

      {/* Mission Telemetry Card */}
      <div className="w-full bg-neutral-900/60 border border-neutral-800/90 p-6 sm:p-8 rounded-2xl text-center space-y-8">
        <div className="inline-flex items-center gap-2 text-xs font-mono text-neutral-400 uppercase tracking-widest">
          <ShieldCheck className="w-4 h-4 text-green-500" /> Mission Standby
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-neutral-950/80 p-4 rounded-xl border border-neutral-800/80">
            <div className="text-xs text-neutral-500 mb-1">Showtime</div>
            <div className="text-sm sm:text-base font-bold text-white truncate">
              {String(appState?.winning_date || "TBD")}
            </div>
          </div>
          <div className="bg-neutral-950/80 p-4 rounded-xl border border-neutral-800/80">
            <div className="text-xs text-neutral-500 mb-1">Squad Cleared</div>
            <div className="text-lg font-bold text-green-400 font-mono">
              {approvedCount} Approved
            </div>
          </div>
          <div className="bg-neutral-950/80 p-4 rounded-xl border border-neutral-800/80">
            <div className="text-xs text-neutral-500 mb-1">Theater Grid</div>
            <div className="text-lg font-bold text-white font-mono">
              {seatCount > 0 ? `${seatCount} Seats` : "Preparing"}
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800/80 pt-6 space-y-2">
          <div className="text-xs text-neutral-500 uppercase font-mono tracking-widest">
            Seat Grid Status
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-extrabold text-green-500 tracking-tight">
            OPENING SOON
          </div>
        </div>
      </div>
    </div>
  );
}
