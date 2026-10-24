"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Seat = {
  id: string;
  row_label: string;
  seat_number: number;
  status: "available" | "occupied" | "unavailable" | "space";
  user_id: string | null;
  users?: { name: string; avatar_url: string };
};

type User = {
  id: string;
  name: string;
};

export default function SeatSelection() {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchSeats();
    fetchApprovedUsers();

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
    if (data) setSeats(data);
  }

  async function fetchApprovedUsers() {
    const { data, error } = await supabase
      .from("users")
      .select("id, name")
      .eq("payment_status", "approved");

    if (error) console.error("Error fetching users:", error);
    if (data) setUsers(data);
  }

  const handleSeatClick = (seat: Seat) => {
    if (seat.status !== "available") return;
    if (!selectedUser) {
      toast.error("Please log in (select your name) first!");
      return;
    }

    // Check if user already has a seat
    const userHasSeat = seats.some(s => s.user_id === selectedUser);
    if (userHasSeat) {
      toast.error("You have already claimed a seat! Rule: One seat per approved ticket.");
      return;
    }

    setSelectedSeat(seat);
    setIsModalOpen(true);
  };

  const confirmSeat = async () => {
    if (!selectedSeat || !selectedUser) return;

    // Optimistic UI update could go here

    const { error } = await supabase
      .from("seats")
      .update({ status: "occupied", user_id: selectedUser })
      .eq("id", selectedSeat.id)
      .eq("status", "available"); // Ensure it wasn't taken in the meantime

    if (error) {
      toast.error("Failed to claim seat. Someone might have beaten you to it!");
    } else {
      toast.success(`Seat ${selectedSeat.row_label}${selectedSeat.seat_number} locked in!`);
    }

    setIsModalOpen(false);
    setSelectedSeat(null);
  };

  // Group seats by row
  const rows = Array.from(new Set(seats.map(s => s.row_label))).sort();

  return (
    <div className="max-w-6xl mx-auto p-6 pt-12 pb-24 relative">
      <header className="mb-12 text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-green-500 uppercase tracking-tighter">The Grid is Live: Claim Your Seat</h1>
        <p className="text-lg text-neutral-300">
          Click any glowing green seat to lock it under your name. <br />
          <span className="text-green-400 font-bold">Rule: One seat per approved ticket. Claims are permanent once confirmed!</span>
        </p>
      </header>

      {/* Login / User Selector */}
      <div className="mb-12 max-w-sm mx-auto">
        <label className="block text-sm font-medium text-neutral-400 mb-2">Identify yourself to claim a seat</label>
        <select
          className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-md p-3 focus:ring-green-500 focus:border-green-500"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
        >
          <option value="">-- Select your approved name --</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Screen / Stage indicator */}
      <div className="w-full max-w-4xl mx-auto mb-16 relative">
        <div className="h-2 w-full bg-gradient-to-r from-transparent via-green-500/50 to-transparent rounded-full shadow-[0_0_30px_rgba(34,197,94,0.3)]"></div>
        <div className="text-center text-neutral-500 text-sm mt-4 uppercase tracking-[0.5em]">Screen</div>
      </div>

      {/* Seating Grid */}
      <div className="space-y-6 max-w-4xl mx-auto">
        {rows.map(row => (
          <div key={row} className="flex justify-center items-center gap-4">
            <div className="w-8 text-center text-neutral-500 font-bold text-xl">{row}</div>
            <div className="flex gap-3">
              {seats.filter(s => s.row_label === row).map(seat => (
                <button
                  key={seat.id}
                  onClick={() => handleSeatClick(seat)}
                  disabled={seat.status !== "available"}
                  className={`
                    relative w-14 h-14 sm:w-16 sm:h-16 rounded-t-xl rounded-b-md border-2 transition-all duration-200 flex flex-col items-center justify-center overflow-hidden
                    ${seat.status === 'available' ? 'border-green-500/50 bg-green-950/20 hover:bg-green-500/20 hover:border-green-400 cursor-pointer shadow-[inset_0_0_10px_rgba(34,197,94,0.1)] hover:shadow-[0_0_15px_rgba(34,197,94,0.4)]' : ''}
                    ${seat.status === 'occupied' ? 'border-neutral-700 bg-neutral-800 cursor-not-allowed' : ''}
                    ${seat.status === 'unavailable' ? 'border-neutral-900 bg-neutral-950 opacity-20 cursor-not-allowed' : ''}
                    ${seat.status === 'space' ? 'opacity-0 cursor-default' : ''}
                  `}
                  title={seat.status === 'occupied' ? `Claimed by ${seat.users?.name}` : seat.status === 'available' ? `Seat ${seat.row_label}${seat.seat_number} — Available` : 'Unavailable'}
                >
                  {seat.status === 'occupied' && seat.users?.avatar_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={seat.users.avatar_url} alt={seat.users.name} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity" />
                      <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] font-bold py-1 truncate px-1 text-center border-t border-neutral-700 z-10">{seat.users.name}</div>
                    </>
                  ) : (
                    <span className={`text-xs font-bold ${seat.status === 'available' ? 'text-green-500' : 'text-neutral-600'}`}>
                      {seat.seat_number}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="w-8 text-center text-neutral-500 font-bold text-xl">{row}</div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {isModalOpen && selectedSeat && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-neutral-900 border-neutral-700">
            <CardContent className="pt-6 text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-green-500/20 border-2 border-green-500 rounded-t-2xl rounded-b-lg flex items-center justify-center mb-6">
                <span className="text-3xl font-bold text-green-400">{selectedSeat.row_label}{selectedSeat.seat_number}</span>
              </div>
              <h3 className="text-2xl font-bold text-white">Lock in Seat {selectedSeat.row_label}{selectedSeat.seat_number}?</h3>
              <p className="text-neutral-400">
                You&apos;ll be securing this spot for the mission. Ready to lock it down?
              </p>
              <div className="flex gap-4 pt-4">
                <Button variant="outline" className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white" onClick={() => setIsModalOpen(false)}>
                  Pick Another
                </Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold" onClick={confirmSeat}>
                  Confirm My Seat
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
