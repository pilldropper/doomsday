"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/UserContext";
import { Armchair, CheckCircle2, Lock, Sparkles } from "lucide-react";

type Seat = {
  id: string;
  row_label: string;
  seat_number: number;
  status: "available" | "occupied" | "unavailable" | "space";
  user_id: string | null;
  users?: { name: string; avatar_url: string };
};

export default function SeatSelection() {
  const { user } = useUser();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    fetchSeats();

    const channel = supabase
      .channel("public:seats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seats" },
        () => {
          fetchSeats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchSeats() {
    const { data, error } = await supabase
      .from("seats")
      .select("*, users(name, avatar_url)")
      .order("row_label", { ascending: true })
      .order("seat_number", { ascending: true });

    if (error) console.error("Error fetching seats:", error);
    if (data) setSeats(data as Seat[]);
  }

  const myCurrentSeat = user
    ? seats.find((s) => s.user_id === user.id && s.status === "occupied")
    : undefined;

  const isApproved = user?.payment_status === "approved";

  const handleSeatClick = (seat: Seat) => {
    if (!user) return;
    if (!isApproved) {
      toast.error(
        "Your payment must be approved by the admin before you can claim a seat."
      );
      return;
    }
    if (seat.id === myCurrentSeat?.id) {
      toast("That's already your locked seat!");
      return;
    }
    if (seat.status !== "available") return;

    setSelectedSeat(seat);
    setIsModalOpen(true);
  };

  const confirmSeat = async () => {
    if (!selectedSeat || !user) return;
    setIsClaiming(true);

    try {
      // If user already holds a seat, release it first
      if (myCurrentSeat) {
        await supabase
          .from("seats")
          .update({ status: "available", user_id: null })
          .eq("id", myCurrentSeat.id)
          .eq("user_id", user.id);
      }

      const { data: claimed, error } = await supabase
        .from("seats")
        .update({ status: "occupied", user_id: user.id })
        .eq("id", selectedSeat.id)
        .eq("status", "available")
        .select()
        .maybeSingle();

      if (error || !claimed) {
        toast.error("Someone just claimed that seat! Pick another one.");
      } else {
        toast.success(
          `Seat ${selectedSeat.row_label}${selectedSeat.seat_number} locked in!`
        );
      }
      await fetchSeats();
    } finally {
      setIsClaiming(false);
      setIsModalOpen(false);
      setSelectedSeat(null);
    }
  };

  const rows = Array.from(new Set(seats.map((s) => s.row_label))).sort();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-24 space-y-10">
      <header className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-green-400">
          <Armchair className="w-3.5 h-3.5" /> Phase 5 {"//"} Live Seat Grid
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Claim Your Seat
        </h1>
        <p className="text-sm text-neutral-400 max-w-lg mx-auto">
          Select any glowing green chair to lock it under{" "}
          <span className="text-neutral-200 font-medium">{user?.name}</span>.
          {myCurrentSeat && " Click another open seat anytime to switch."}
        </p>
      </header>

      {/* Personal Seat Status Bar */}
      <div className="max-w-xl mx-auto">
        {!isApproved ? (
          <div className="flex items-center justify-center gap-2.5 p-4 rounded-xl bg-amber-950/20 border border-amber-500/40 text-amber-300 text-xs sm:text-sm">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              View-only mode: Your ticket payment is pending admin approval.
            </span>
          </div>
        ) : myCurrentSeat ? (
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-green-500/10 border border-green-500/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500 text-neutral-950 font-mono font-extrabold text-sm flex items-center justify-center">
                {myCurrentSeat.row_label}
                {myCurrentSeat.seat_number}
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Seat Locked
                </div>
                <div className="text-sm font-semibold text-white">
                  Row {myCurrentSeat.row_label}, Seat{" "}
                  {myCurrentSeat.seat_number}
                </div>
              </div>
            </div>
            <span className="text-xs text-neutral-400 hidden sm:inline">
              Click any open seat to switch
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 text-neutral-300 text-xs sm:text-sm">
            <Sparkles className="w-4 h-4 text-green-400 shrink-0" />
            <span>
              You are cleared! Click any green seat below to claim your spot.
            </span>
          </div>
        )}
      </div>

      {/* Screen Indicator */}
      <div className="w-full max-w-3xl mx-auto pt-2">
        <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-green-500/60 to-transparent rounded-full shadow-[0_0_25px_rgba(34,197,94,0.35)]" />
        <div className="text-center text-neutral-500 text-[11px] font-mono mt-3 uppercase tracking-[0.5em]">
          Cinema Screen
        </div>
      </div>

      {/* Seating Grid */}
      <div className="space-y-4 overflow-x-auto py-2">
        {rows.map((row) => (
          <div
            key={row}
            className="flex justify-center items-center gap-3 min-w-max mx-auto px-2"
          >
            <div className="w-6 text-center text-neutral-500 font-mono font-bold text-sm">
              {row}
            </div>
            <div className="flex gap-2.5">
              {seats
                .filter((s) => s.row_label === row)
                .map((seat) => {
                  const isMine = user && seat.user_id === user.id;
                  return (
                    <button
                      key={seat.id}
                      onClick={() => handleSeatClick(seat)}
                      disabled={seat.status !== "available" && !isMine}
                      className={`
                        relative w-12 h-12 sm:w-14 sm:h-14 rounded-t-xl rounded-b-md border transition-all duration-150 flex flex-col items-center justify-center overflow-hidden
                        ${
                          isMine
                            ? "border-green-400 bg-green-500/20 ring-2 ring-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                            : seat.status === "available"
                            ? "border-green-500/40 bg-green-950/20 hover:bg-green-500/20 hover:border-green-400 cursor-pointer"
                            : seat.status === "occupied"
                            ? "border-neutral-700 bg-neutral-900 cursor-not-allowed"
                            : seat.status === "unavailable"
                            ? "border-neutral-900 bg-neutral-950 opacity-20 cursor-not-allowed"
                            : "opacity-0 pointer-events-none"
                        }
                      `}
                      title={
                        seat.status === "occupied"
                          ? `Claimed by ${seat.users?.name || "kirigta Member"}`
                          : seat.status === "available"
                          ? `Seat ${seat.row_label}${seat.seat_number} — Available`
                          : "Unavailable"
                      }
                    >
                      {seat.status === "occupied" ? (
                        <>
                          {seat.users?.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={seat.users.avatar_url}
                              alt={seat.users.name}
                              className="absolute inset-0 w-full h-full object-cover opacity-75"
                            />
                          ) : (
                            <span className="text-xs font-bold text-neutral-300">
                              {seat.users?.name?.charAt(0) || "•"}
                            </span>
                          )}
                          <div
                            className={`absolute bottom-0 inset-x-0 text-[9px] font-bold py-0.5 truncate px-1 text-center border-t z-10 ${
                              isMine
                                ? "bg-green-500 text-neutral-950 border-green-400"
                                : "bg-black/85 text-neutral-200 border-neutral-800"
                            }`}
                          >
                            {isMine ? "YOU" : seat.users?.name}
                          </div>
                        </>
                      ) : (
                        <span
                          className={`text-xs font-mono font-bold ${
                            seat.status === "available"
                              ? "text-green-400"
                              : "text-neutral-700"
                          }`}
                        >
                          {seat.row_label}
                          {seat.seat_number}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
            <div className="w-6 text-center text-neutral-500 font-mono font-bold text-sm">
              {row}
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="text-center text-neutral-500 py-12 text-sm">
            No seats have been configured on the map yet.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-sm border border-green-500/50 bg-green-950/40" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-sm border border-green-400 bg-green-500/40" />
          <span>Your Seat</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-sm border border-neutral-700 bg-neutral-800" />
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-sm border border-neutral-900 bg-neutral-950 opacity-30" />
          <span>Unavailable</span>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isModalOpen && selectedSeat && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm bg-neutral-900 border-neutral-800">
            <CardContent className="pt-6 text-center space-y-5">
              <div className="w-16 h-16 mx-auto bg-green-500/15 border border-green-500/50 rounded-t-2xl rounded-b-lg flex items-center justify-center">
                <span className="text-2xl font-mono font-extrabold text-green-400">
                  {selectedSeat.row_label}
                  {selectedSeat.seat_number}
                </span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-white">
                  {myCurrentSeat
                    ? `Switch to Seat ${selectedSeat.row_label}${selectedSeat.seat_number}?`
                    : `Claim Seat ${selectedSeat.row_label}${selectedSeat.seat_number}?`}
                </h3>
                <p className="text-xs text-neutral-400">
                  {myCurrentSeat
                    ? `This will release your current seat (${myCurrentSeat.row_label}${myCurrentSeat.seat_number}) and move you to ${selectedSeat.row_label}${selectedSeat.seat_number}.`
                    : `Locking this spot under ${user?.name}.`}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isClaiming}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-10 bg-green-600 hover:bg-green-500 text-white font-semibold"
                  onClick={confirmSeat}
                  disabled={isClaiming}
                >
                  {isClaiming ? "Locking..." : "Confirm Seat"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
