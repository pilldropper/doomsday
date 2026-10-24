"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Toaster } from "sonner";
import RsvpOpen from "./components/RsvpOpen";
import WaitingRoom from "./components/WaitingRoom";
import SeatSelection from "./components/SeatSelection";
import GameDay from "./components/GameDay";

export default function Home() {
  const [appState, setAppState] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppState();

    const channel = supabase
      .channel('public:app_state')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_state' },
        (payload) => {
          setAppState(payload.new as Record<string, unknown>);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchAppState() {
    try {
      const { data, error } = await supabase
        .from("app_state")
        .select("*")
        .eq("id", 1)
        .single();

      if (error) {
        console.error("Error fetching app state:", error);
        setAppState({ current_phase: "RSVP_OPEN" }); // Fallback
      } else if (data) {
        setAppState(data);
      } else {
        setAppState({ current_phase: "RSVP_OPEN" });
      }
    } catch {
      setAppState({ current_phase: "RSVP_OPEN" });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black text-green-500">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50 selection:bg-green-500/30">
      {appState?.current_phase === "RSVP_OPEN" && <RsvpOpen onComplete={fetchAppState} />}
      {appState?.current_phase === "WAITING_ROOM" && <WaitingRoom appState={appState} />}
      {appState?.current_phase === "SEAT_SELECTION" && <SeatSelection />}
      {appState?.current_phase === "GAME_DAY" && <GameDay appState={appState} />}
      <Toaster theme="dark" />
    </main>
  );
}
