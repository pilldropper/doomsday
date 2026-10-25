"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Toaster } from "sonner";
import RsvpOpen from "./components/RsvpOpen";
import WaitingRoom from "./components/WaitingRoom";
import SeatSelection from "./components/SeatSelection";
import GameDay from "./components/GameDay";
import DateConfirmation from "./components/DateConfirmation";
import PaymentPhase from "./components/PaymentPhase";
import Login from "./components/Login";
import { useUser } from "@/lib/UserContext";
import { LogOut, Film } from "lucide-react";

const PHASES = [
  { key: "RSVP_OPEN", label: "1. Vote" },
  { key: "DATE_CONFIRMATION", label: "2. Confirm" },
  { key: "PAYMENT", label: "3. Fund" },
  { key: "WAITING_ROOM", label: "4. Standby" },
  { key: "SEAT_SELECTION", label: "5. Seats" },
  { key: "GAME_DAY", label: "6. Game Day" },
];

export default function Home() {
  const [appState, setAppState] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, loadingUser, logout } = useUser();

  useEffect(() => {
    fetchAppState();

    const channel = supabase
      .channel("public:app_state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_state" },
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
        setAppState({ current_phase: "RSVP_OPEN" });
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

  if (loading || loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400 font-mono text-xs uppercase tracking-[0.3em]">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-ping mr-3" />
        Initializing Mission...
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-50">
        <Login />
        <Toaster theme="dark" position="top-center" />
      </main>
    );
  }

  const currentPhaseKey = String(appState?.current_phase || "RSVP_OPEN");
  const currentPhaseIdx = PHASES.findIndex((p) => p.key === currentPhaseKey);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50 pb-24">
      {/* Minimal Sticky Top Navigation */}
      <nav className="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-md bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400">
              <Film className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-xs font-bold tracking-[0.2em] uppercase text-neutral-200">
              Doomsday <span className="text-green-500">{"//"}</span> kirigta
            </span>
          </div>

          {/* Phase Stepper (Desktop) */}
          <div className="hidden lg:flex items-center gap-1 bg-neutral-900/60 border border-neutral-800/80 rounded-full px-2 py-1">
            {PHASES.map((phase, idx) => {
              const isActive = phase.key === currentPhaseKey;
              const isPast = currentPhaseIdx > idx;
              return (
                <div
                  key={phase.key}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-colors ${
                    isActive
                      ? "bg-green-500/15 text-green-400 border border-green-500/30 font-semibold"
                      : isPast
                      ? "text-neutral-400"
                      : "text-neutral-600"
                  }`}
                >
                  {phase.label}
                </div>
              );
            })}
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 rounded-full pl-1.5 pr-3 py-1">
              {user.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-5 h-5 rounded-full object-cover bg-neutral-800"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold flex items-center justify-center">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium text-neutral-200 max-w-[120px] truncate">
                {user.name}
              </span>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {currentPhaseKey === "RSVP_OPEN" && (
        <RsvpOpen appState={appState} onComplete={fetchAppState} />
      )}
      {currentPhaseKey === "DATE_CONFIRMATION" && (
        <DateConfirmation appState={appState} />
      )}
      {currentPhaseKey === "PAYMENT" && <PaymentPhase appState={appState} />}
      {currentPhaseKey === "WAITING_ROOM" && <WaitingRoom appState={appState} />}
      {currentPhaseKey === "SEAT_SELECTION" && <SeatSelection />}
      {currentPhaseKey === "GAME_DAY" && <GameDay appState={appState} />}
      <Toaster theme="dark" position="top-center" />
    </main>
  );
}
