"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/UserContext";
import { Ticket, MapPin, Calendar, Clock } from "lucide-react";

type GameDaySeat = {
  id: string;
  row_label: string;
  seat_number: number;
  status: string;
  user_id: string | null;
  users?: { name: string; avatar_url: string };
};

export default function GameDay({
  appState,
}: {
  appState: Record<string, unknown> | null;
}) {
  const { user } = useUser();
  const [seats, setSeats] = useState<GameDaySeat[]>([]);

  useEffect(() => {
    async function fetchSeats() {
      const { data } = await supabase
        .from("seats")
        .select("*, users(name, avatar_url)")
        .order("row_label", { ascending: true })
        .order("seat_number", { ascending: true });
      if (data) setSeats(data as GameDaySeat[]);
    }
    fetchSeats();
  }, []);

  const rows = Array.from(new Set(seats.map((s) => s.row_label))).sort();
  const mySeat = user
    ? seats.find((s) => s.user_id === user.id && s.status === "occupied")
    : undefined;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-24 space-y-12">
      <header className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-green-400">
          <Ticket className="w-3.5 h-3.5" /> Phase 6 {"//"} Mission Debrief
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight uppercase">
          Ready for Doomsday
        </h1>
      </header>

      {/* Minimal Boarding Pass / Ticket Card */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden relative max-w-3xl mx-auto">
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-green-400">
                Avengers: Doomsday {"//"} Squad Block
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                {user?.name}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-neutral-800/80 text-xs">
              <div className="space-y-1">
                <div className="text-neutral-500 flex items-center gap-1 uppercase font-mono">
                  <MapPin className="w-3 h-3" /> Cinema
                </div>
                <div className="font-semibold text-neutral-200 text-sm">
                  {String(appState?.cinema_details || "TBD")}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-neutral-500 flex items-center gap-1 uppercase font-mono">
                  <Calendar className="w-3 h-3" /> Showtime
                </div>
                <div className="font-semibold text-neutral-200 text-sm">
                  {String(appState?.winning_date || "TBD")}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-neutral-500 flex items-center gap-1 uppercase font-mono">
                  <Clock className="w-3 h-3" /> Call Time
                </div>
                <div className="font-semibold text-green-400 text-sm">
                  45m prior @ Snack Bar
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Seat Stub */}
          <div className="sm:border-l sm:border-dashed border-neutral-800 sm:pl-6 flex sm:flex-col items-center justify-between sm:justify-center bg-neutral-950/60 sm:bg-transparent p-4 sm:p-0 rounded-xl">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Assigned Seat
            </span>
            <span className="text-3xl sm:text-4xl font-mono font-extrabold text-green-400 mt-1">
              {mySeat ? `${mySeat.row_label}${mySeat.seat_number}` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Screen Indicator */}
      <div className="w-full max-w-3xl mx-auto pt-4">
        <div className="h-1 w-full bg-neutral-800 rounded-full" />
        <div className="text-center text-neutral-600 text-[11px] font-mono mt-3 uppercase tracking-[0.5em]">
          Cinema Screen
        </div>
      </div>

      {/* Final Locked Seating Grid */}
      <div className="space-y-4 overflow-x-auto py-2">
        {rows.map((row) => (
          <div
            key={row}
            className="flex justify-center items-center gap-3 min-w-max mx-auto px-2"
          >
            <div className="w-6 text-center text-neutral-600 font-mono font-bold text-sm">
              {row}
            </div>
            <div className="flex gap-2.5">
              {seats
                .filter((s) => s.row_label === row)
                .map((seat) => {
                  const isMine = user && seat.user_id === user.id;
                  return (
                    <div
                      key={seat.id}
                      className={`
                        relative w-12 h-12 sm:w-14 sm:h-14 rounded-t-xl rounded-b-md flex flex-col items-center justify-center overflow-hidden
                        ${
                          isMine
                            ? "bg-green-500/20 border-2 border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.25)]"
                            : seat.status === "occupied"
                            ? "bg-neutral-800 border border-neutral-700"
                            : seat.status === "available"
                            ? "bg-neutral-900/60 border border-neutral-800/80"
                            : "bg-transparent opacity-0"
                        }
                      `}
                    >
                      {seat.status === "occupied" ? (
                        <>
                          {seat.users?.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={seat.users.avatar_url}
                              alt={seat.users.name}
                              className="absolute inset-0 w-full h-full object-cover opacity-80"
                            />
                          ) : (
                            <span className="text-xs font-bold text-neutral-300">
                              {seat.users?.name?.charAt(0)}
                            </span>
                          )}
                          <div
                            className={`absolute bottom-0 inset-x-0 text-[8px] sm:text-[9px] font-bold py-0.5 truncate px-1 text-center border-t ${
                              isMine
                                ? "bg-green-500 text-neutral-950 border-green-400"
                                : "bg-black/90 text-neutral-200 border-neutral-800"
                            }`}
                          >
                            {isMine ? "YOU" : seat.users?.name}
                          </div>
                        </>
                      ) : seat.status === "available" ? (
                        <span className="text-[10px] text-neutral-600 font-mono">
                          {seat.row_label}
                          {seat.seat_number}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
            </div>
            <div className="w-6 text-center text-neutral-600 font-mono font-bold text-sm">
              {row}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
