"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GameDay({ appState }: { appState: Record<string, unknown> | null }) {
  const [seats, setSeats] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    async function fetchSeats() {
      const { data } = await supabase
        .from("seats")
        .select("*, users(name, avatar_url)")
        .order("row_label", { ascending: true })
        .order("seat_number", { ascending: true });
      if (data) setSeats(data);
    }
    fetchSeats();
  }, []);

  const rows = Array.from(new Set(seats.map(s => String(s.row_label)))).sort();

  return (
    <div className="max-w-5xl mx-auto p-6 pt-12 pb-24">
      <header className="mb-16 text-center space-y-4">
        <h1 className="text-5xl md:text-6xl font-extrabold text-green-500 uppercase tracking-tighter">We&apos;re Ready for Doomsday</h1>
      </header>

      <Card className="bg-neutral-900 border-neutral-800 mb-16 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <CardHeader>
          <CardTitle className="text-2xl text-green-400 uppercase tracking-wide">Mission Debrief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-lg relative z-10">
          <div className="flex flex-col md:flex-row gap-6 md:gap-12">
            <div className="space-y-1">
              <div className="text-neutral-500 text-sm uppercase tracking-wider">Cinema</div>
              <div className="font-bold text-white text-xl">{String(appState?.cinema_details || 'TBD')}</div>
            </div>
            <div className="space-y-1">
              <div className="text-neutral-500 text-sm uppercase tracking-wider">Date & Show</div>
              <div className="font-bold text-white text-xl">{String(appState?.winning_date || 'TBD')}</div>
            </div>
            <div className="space-y-1">
              <div className="text-neutral-500 text-sm uppercase tracking-wider">Call Time</div>
              <div className="font-bold text-green-400 text-xl">45 mins prior @ Snack Bar</div>
            </div>
          </div>
          <p className="text-neutral-400 pt-6 border-t border-neutral-800/50">
            Check the full seating chart below to see who you&apos;re sitting next to!
          </p>
        </CardContent>
      </Card>

      {/* Screen / Stage indicator */}
      <div className="w-full max-w-4xl mx-auto mb-16 relative">
        <div className="h-1 w-full bg-neutral-800 rounded-full"></div>
        <div className="text-center text-neutral-600 text-xs mt-4 uppercase tracking-[0.5em]">Screen</div>
      </div>

      {/* Locked Seating Grid */}
      <div className="space-y-4 max-w-4xl mx-auto opacity-90">
        {rows.map(row => (
          <div key={String(row)} className="flex justify-center items-center gap-4">
            <div className="w-8 text-center text-neutral-600 font-bold">{String(row)}</div>
            <div className="flex gap-2">
              {seats.filter(s => s.row_label === row).map(seat => (
                <div
                  key={String(seat.id)}
                  className={`
                    relative w-12 h-12 sm:w-14 sm:h-14 rounded-t-lg rounded-b flex flex-col items-center justify-center overflow-hidden
                    ${seat.status === 'occupied' ? 'bg-neutral-800 border border-neutral-700' : ''}
                    ${seat.status === 'available' ? 'bg-neutral-900 border border-neutral-800' : ''}
                    ${seat.status === 'unavailable' ? 'bg-transparent opacity-0' : ''}
                    ${seat.status === 'space' ? 'bg-transparent opacity-0' : ''}
                  `}
                >
                  {seat.status === 'occupied' && (seat.users as Record<string, unknown>)?.avatar_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={String((seat.users as Record<string, unknown>).avatar_url)} alt={String((seat.users as Record<string, unknown>).name)} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                      <div className="absolute bottom-0 inset-x-0 bg-black/90 text-[8px] sm:text-[10px] font-bold py-0.5 truncate px-1 text-center border-t border-neutral-800">{String((seat.users as Record<string, unknown>).name)}</div>
                    </>
                  ) : seat.status === 'available' ? (
                     <span className="text-[10px] text-neutral-600 font-mono">EMPTY</span>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="w-8 text-center text-neutral-600 font-bold">{String(row)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
