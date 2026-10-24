"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Users, X, CheckCircle2, Clock, Armchair, XCircle } from "lucide-react";

type RosterUser = {
  id: string;
  name: string;
  avatar_url: string;
  voted_dates: string[] | null;
  is_available: boolean | null;
  payment_status: string;
};

type RosterSeat = {
  user_id: string | null;
  row_label: string;
  seat_number: number;
  status: string;
};

export default function SquadRosterTab() {
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<RosterUser[]>([]);
  const [seats, setSeats] = useState<RosterSeat[]>([]);

  useEffect(() => {
    fetchRoster();

    const channel = supabase
      .channel("public:roster_tab")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        fetchRoster
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seats" },
        fetchRoster
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchRoster() {
    const [usersRes, seatsRes] = await Promise.all([
      supabase
        .from("users")
        .select(
          "id, name, avatar_url, voted_dates, is_available, payment_status"
        )
        .order("created_at", { ascending: true }),
      supabase
        .from("seats")
        .select("user_id, row_label, seat_number, status")
        .eq("status", "occupied"),
    ]);

    if (usersRes.data) setMembers(usersRes.data as RosterUser[]);
    if (seatsRes.data) setSeats(seatsRes.data as RosterSeat[]);
  }

  // Members who haven't explicitly said "No"
  const activeComing = members.filter((m) => m.is_available !== false);
  const confirmedOrApproved = members.filter(
    (m) => m.is_available === true || m.payment_status === "approved"
  );
  const displayAvatars =
    confirmedOrApproved.length > 0 ? confirmedOrApproved : activeComing;

  const getSeatForUser = (userId: string) => {
    const s = seats.find((seat) => seat.user_id === userId);
    return s ? `${s.row_label}${s.seat_number}` : null;
  };

  return (
    <>
      {/* Compact Floating Tab (Bottom-Left) */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle Who's Coming Roster"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2.5 bg-neutral-900/95 hover:bg-neutral-800/95 border border-neutral-800 hover:border-green-500/40 text-neutral-200 px-3.5 py-2 rounded-full shadow-xl backdrop-blur-md transition-all"
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <Users className="w-3.5 h-3.5 text-green-400" />
        </div>

        {displayAvatars.length > 0 && (
          <div className="flex -space-x-1.5 overflow-hidden">
            {displayAvatars.slice(0, 4).map((m) =>
              m.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={m.id}
                  src={m.avatar_url}
                  alt={m.name}
                  className="inline-block w-5 h-5 rounded-full ring-2 ring-neutral-900 object-cover bg-neutral-800"
                />
              ) : (
                <div
                  key={m.id}
                  className="inline-flex w-5 h-5 rounded-full ring-2 ring-neutral-900 bg-neutral-800 text-[9px] font-bold text-neutral-300 items-center justify-center"
                >
                  {m.name.charAt(0).toUpperCase()}
                </div>
              )
            )}
          </div>
        )}

        <span className="text-xs font-mono font-medium">
          {confirmedOrApproved.length > 0
            ? `${confirmedOrApproved.length} Going`
            : `${activeComing.length} in Squad`}
        </span>
      </button>

      {/* Popover Roster Panel */}
      <div
        className={`fixed bottom-20 left-6 w-72 sm:w-80 max-h-[380px] bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-2xl shadow-2xl flex flex-col z-50 transition-all duration-200 origin-bottom-left ${
          isOpen
            ? "scale-100 opacity-100"
            : "scale-95 opacity-0 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950/80 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-green-400" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-white">
              Who&apos;s Coming
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-neutral-400">
              {activeComing.length} total
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-500 hover:text-white p-1 rounded-md hover:bg-neutral-900 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {members.length === 0 && (
            <div className="py-8 text-center text-xs text-neutral-600">
              No squad members registered yet.
            </div>
          )}

          {members.map((m) => {
            const seatLabel = getSeatForUser(m.id);
            const isOut = m.is_available === false;
            const isPaid = m.payment_status === "approved";
            const isPendingPay = m.payment_status === "pending";
            const isGoing = m.is_available === true;
            const hasVoted = (m.voted_dates?.length || 0) > 0;

            return (
              <div
                key={m.id}
                className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border ${
                  isOut
                    ? "bg-neutral-950/40 border-neutral-900 opacity-50"
                    : "bg-neutral-950/80 border-neutral-800/80"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {m.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.avatar_url}
                      alt={m.name}
                      className="w-7 h-7 rounded-full object-cover bg-neutral-800 shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 text-[10px] font-bold text-neutral-300 flex items-center justify-center shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-neutral-200 truncate">
                      {m.name}
                    </div>
                    {seatLabel && (
                      <div className="text-[10px] font-mono text-green-400 flex items-center gap-1">
                        <Armchair className="w-2.5 h-2.5" /> Seat {seatLabel}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <div className="shrink-0">
                  {isOut ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
                      <XCircle className="w-2.5 h-2.5" /> Out
                    </span>
                  ) : isPaid ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-green-500/15 text-green-400 border border-green-500/30">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Paid
                    </span>
                  ) : isPendingPay ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <Clock className="w-2.5 h-2.5" /> Verifying
                    </span>
                  ) : isGoing ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-green-500/10 text-green-400 border border-green-500/25">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Going
                    </span>
                  ) : hasVoted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-800 text-neutral-300">
                      Voted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-900 text-neutral-500">
                      Joined
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
