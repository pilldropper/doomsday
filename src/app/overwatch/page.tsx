"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from "sonner";
import {
  Trash2,
  Plus,
  Trophy,
  Clock,
  ArrowLeft,
  Shield,
  RotateCcw,
} from "lucide-react";

function formatTime12h(time24: string): string {
  if (!time24) return "";
  const [hourStr, minuteStr] = time24.split(":");
  if (hourStr === undefined || minuteStr === undefined) return "";
  let hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return "";
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minuteStr} ${ampm}`;
}

function parseTime24h(time12: string): string {
  const match = time12.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "";
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const period = match[3].toUpperCase();
  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function parseDateChoice(choice: string): {
  isDate: boolean;
  date: string;
  time24: string;
} {
  const match = choice
    .trim()
    .match(
      /^(\d{4}-\d{2}-\d{2})(?:\s*(?:•|@|-|\|)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)))?$/i
    );
  if (!match) {
    return { isDate: false, date: "", time24: "" };
  }
  return {
    isDate: true,
    date: match[1],
    time24: match[2] ? parseTime24h(match[2]) : "",
  };
}

function buildDateChoice(date: string, time24: string): string {
  const formattedTime = formatTime12h(time24);
  return formattedTime ? `${date} • ${formattedTime}` : date;
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("ledger");

  // Data state
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [appState, setAppState] = useState<Record<string, unknown> | null>(
    null
  );
  const [seats, setSeats] = useState<Record<string, unknown>[]>([]);

  // New voting choice inputs
  const [newChoiceDate, setNewChoiceDate] = useState("2026-12-18");
  const [newChoiceTime, setNewChoiceTime] = useState("19:00");
  const [newCustomChoice, setNewCustomChoice] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      password === process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY ||
      password === "chinkodaisuki"
    ) {
      setIsAuthenticated(true);
      fetchData();
    } else {
      toast.error("Access Denied");
    }
  };

  const fetchData = async () => {
    const [usersRes, stateRes, seatsRes] = await Promise.all([
      supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("app_state").select("*").eq("id", 1).single(),
      supabase
        .from("seats")
        .select("*, users(name)")
        .order("row_label")
        .order("seat_number"),
    ]);

    if (usersRes.data) setUsers(usersRes.data);
    if (stateRes.data) setAppState(stateRes.data);
    if (seatsRes.data) setSeats(seatsRes.data);
  };

  const toggleUserStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "approved" ? "pending" : "approved";
    const { error } = await supabase
      .from("users")
      .update({ payment_status: newStatus })
      .eq("id", id);
    if (error) toast.error("Update failed");
    else {
      toast.success(`Status updated to ${newStatus}`);
      fetchData();
    }
  };

  const deleteUser = async (id: string, name: string) => {
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) toast.error("Failed to remove user");
    else {
      toast.success(`Removed ${name}`);
      fetchData();
    }
  };

  const updateAppState = async (field: string, value: unknown) => {
    setAppState((prev) =>
      prev ? { ...prev, [field]: value } : { [field]: value }
    );
    const { error } = await supabase
      .from("app_state")
      .update({ [field]: value })
      .eq("id", 1);
    if (error) toast.error("Failed to update state");
    else {
      toast.success(`App state updated: ${field}`);
      fetchData();
    }
  };

  const votingDates = (appState?.voting_dates as string[]) || [];

  const handleAddDateChoice = async () => {
    if (!newChoiceDate) {
      toast.error("Please pick a date first");
      return;
    }
    const formatted = buildDateChoice(newChoiceDate, newChoiceTime);
    if (votingDates.includes(formatted)) {
      toast.error("That date & time choice already exists");
      return;
    }
    await updateAppState("voting_dates", [...votingDates, formatted]);
  };

  const handleAddCustomChoice = async () => {
    const trimmed = newCustomChoice.trim();
    if (!trimmed) return;
    if (votingDates.includes(trimmed)) {
      toast.error("That choice already exists");
      return;
    }
    setNewCustomChoice("");
    await updateAppState("voting_dates", [...votingDates, trimmed]);
  };

  const handleUpdateChoiceAtIndex = async (
    index: number,
    updatedValue: string
  ) => {
    const updated = [...votingDates];
    updated[index] = updatedValue;
    await updateAppState("voting_dates", updated);
  };

  const handleDeleteChoiceAtIndex = async (index: number) => {
    const updated = votingDates.filter((_, idx) => idx !== index);
    await updateAppState("voting_dates", updated);
  };

  const getVoteCount = (choice: string) => {
    return users.filter(
      (u) =>
        Array.isArray(u.voted_dates) &&
        (u.voted_dates as string[]).includes(choice)
    ).length;
  };

  const [seatConfig, setSeatConfig] = useState({ rowLabel: "A", count: 12 });
  const generateSeatsRow = async () => {
    const newSeats = [];
    for (let i = 1; i <= seatConfig.count; i++) {
      newSeats.push({
        row_label: seatConfig.rowLabel,
        seat_number: i,
        status: "available",
      });
    }
    const { error } = await supabase.from("seats").insert(newSeats);
    if (error) toast.error("Failed to generate row");
    else {
      toast.success(`Row ${seatConfig.rowLabel} generated`);
      fetchData();
    }
  };

  const deleteSeat = async (id: string) => {
    await supabase.from("seats").delete().eq("id", id);
    fetchData();
  };

  const deleteRow = async (rowLabel: string) => {
    await supabase.from("seats").delete().eq("row_label", rowLabel);
    toast.success(`Row ${rowLabel} deleted`);
    fetchData();
  };

  const toggleSeatStatus = async (
    id: string,
    currentStatus: string,
    action?: string
  ) => {
    let newStatus = "available";
    if (action === "space") {
      newStatus = currentStatus === "space" ? "available" : "space";
    } else if (action === "free") {
      await supabase
        .from("seats")
        .update({ status: "available", user_id: null })
        .eq("id", id);
      fetchData();
      return;
    } else {
      newStatus =
        currentStatus === "unavailable" ? "available" : "unavailable";
    }
    await supabase.from("seats").update({ status: newStatus }).eq("id", id);
    fetchData();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <div className="w-full max-w-xs space-y-6 text-center">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 flex items-center justify-center mx-auto">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-mono font-bold uppercase tracking-widest text-white">
              Overwatch Terminal
            </h1>
            <p className="text-xs text-neutral-500">
              Enter command authorization code
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 bg-neutral-900 border-neutral-800 text-center tracking-widest text-green-400"
              placeholder="Command Code"
              autoFocus
            />
            <Button
              type="submit"
              className="w-full h-10 bg-green-600 hover:bg-green-500 text-white font-semibold"
            >
              Unlock Overwatch
            </Button>
          </form>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to kirigta Portal
          </Link>
        </div>
        <Toaster theme="dark" position="top-center" />
      </div>
    );
  }

  const confirmedCount = users.filter((u) => u.is_available === true).length;
  const approvedCount = users.filter(
    (u) => u.payment_status === "approved"
  ).length;
  const occupiedSeatsCount = seats.filter(
    (s) => s.status === "occupied"
  ).length;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-300 p-4 sm:p-8 font-mono max-w-6xl mx-auto space-y-8">
      <header className="flex flex-wrap justify-between items-center gap-4 border-b border-neutral-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl text-green-500 font-bold uppercase tracking-widest">
              Overwatch {"//"} Command
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] bg-green-500/10 border border-green-500/30 text-green-400">
              {String(appState?.current_phase || "RSVP_OPEN")}
            </span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300"
          >
            <ArrowLeft className="w-3 h-3" /> View Live kirigta Portal
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeTab === "ledger" ? "default" : "outline"}
            onClick={() => setActiveTab("ledger")}
          >
            Master Ledger
          </Button>
          <Button
            variant={activeTab === "state" ? "default" : "outline"}
            onClick={() => setActiveTab("state")}
          >
            App State
          </Button>
          <Button
            variant={activeTab === "seats" ? "default" : "outline"}
            onClick={() => setActiveTab("seats")}
          >
            Seat Map Builder
          </Button>
        </div>
      </header>

      {/* Summary Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
          <div className="text-[11px] text-neutral-500 uppercase">
            Registered kirigta
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {users.length}
          </div>
        </div>
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
          <div className="text-[11px] text-neutral-500 uppercase">
            Confirmed In
          </div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {confirmedCount}
          </div>
        </div>
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
          <div className="text-[11px] text-neutral-500 uppercase">
            Payment Approved
          </div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {approvedCount}
          </div>
        </div>
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
          <div className="text-[11px] text-neutral-500 uppercase">
            Seats Claimed
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {occupiedSeatsCount} /{" "}
            {
              seats.filter(
                (s) => s.status === "available" || s.status === "occupied"
              ).length
            }
          </div>
        </div>
      </div>

      {activeTab === "ledger" && (
        <div className="space-y-4">
          <h2 className="text-lg text-white font-bold">RSVP Ledger</h2>
          <div className="bg-neutral-900/70 rounded-xl overflow-x-auto border border-neutral-800">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-neutral-950 text-neutral-500 uppercase text-[11px]">
                <tr>
                  <th className="p-4">Member</th>
                  <th className="p-4">Voted Slots</th>
                  <th className="p-4">Going?</th>
                  <th className="p-4">Receipt</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {users.map((u) => (
                  <tr key={String(u.id)} className="hover:bg-neutral-800/40">
                    <td className="p-4 font-bold text-white flex items-center gap-3">
                      {Boolean(u.avatar_url) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={String(u.avatar_url)}
                          className="w-8 h-8 rounded-full object-cover bg-neutral-800 shrink-0"
                          alt=""
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs shrink-0">
                          {String(u.name).charAt(0)}
                        </div>
                      )}
                      <span className="truncate max-w-[140px]">
                        {String(u.name)}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-neutral-300 max-w-xs">
                      {(u.voted_dates as string[])?.length
                        ? (u.voted_dates as string[]).join(", ")
                        : "—"}
                    </td>
                    <td className="p-4">
                      {u.is_available === true ? (
                        <span className="text-green-400 font-bold">YES</span>
                      ) : u.is_available === false ? (
                        <span className="text-red-400 font-bold">NO</span>
                      ) : (
                        <span className="text-neutral-600">TBD</span>
                      )}
                    </td>
                    <td className="p-4">
                      {u.payment_receipt_url ? (
                        <a
                          href={String(u.payment_receipt_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-green-400 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-neutral-600">None</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-[11px] font-bold ${
                          u.payment_status === "approved"
                            ? "bg-green-500/15 text-green-400 border border-green-500/30"
                            : u.payment_status === "pending"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {String(u.payment_status).toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      <Button
                        size="xs"
                        variant={
                          u.payment_status === "approved"
                            ? "outline"
                            : "default"
                        }
                        onClick={() =>
                          toggleUserStatus(
                            String(u.id),
                            String(u.payment_status)
                          )
                        }
                      >
                        {u.payment_status === "approved"
                          ? "Set Pending"
                          : "Approve"}
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="destructive"
                        title="Remove User"
                        onClick={() =>
                          deleteUser(String(u.id), String(u.name))
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-neutral-600"
                    >
                      No RSVPs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "state" && (
        <div className="space-y-8 max-w-2xl">
          <div className="space-y-6 bg-neutral-900/70 p-6 rounded-xl border border-neutral-800">
            <h2 className="text-lg font-bold text-white">
              Global State Controller
            </h2>

            <div className="space-y-2">
              <label className="text-xs text-neutral-400 uppercase">
                Current Phase
              </label>
              <select
                value={String(appState?.current_phase || "")}
                onChange={(e) =>
                  updateAppState("current_phase", e.target.value)
                }
                className="w-full bg-neutral-950 border border-neutral-800 p-2.5 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              >
                <option value="RSVP_OPEN">Phase 1: RSVP_OPEN (Date Poll)</option>
                <option value="DATE_CONFIRMATION">
                  Phase 2: DATE_CONFIRMATION (Final Headcount)
                </option>
                <option value="PAYMENT">
                  Phase 3: PAYMENT (Receipt Upload)
                </option>
                <option value="WAITING_ROOM">
                  Phase 4: WAITING_ROOM (Standby)
                </option>
                <option value="SEAT_SELECTION">
                  Phase 5: SEAT_SELECTION (Live Grid)
                </option>
                <option value="GAME_DAY">
                  Phase 6: GAME_DAY (Boarding Pass)
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-neutral-400 uppercase">
                Winning Date &amp; Time (Displayed in Phases 2–6)
              </label>
              <Input
                value={String(appState?.winning_date || "")}
                onChange={(e) =>
                  setAppState({ ...appState, winning_date: e.target.value })
                }
                onBlur={(e) => updateAppState("winning_date", e.target.value)}
                placeholder="e.g. 2026-12-18 • 7:00 PM"
                className="h-9 bg-neutral-950 border-neutral-800"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-neutral-400 uppercase">
                Cinema Details (Displayed on Game Day)
              </label>
              <Input
                value={String(appState?.cinema_details || "")}
                onChange={(e) =>
                  setAppState({ ...appState, cinema_details: e.target.value })
                }
                onBlur={(e) => updateAppState("cinema_details", e.target.value)}
                placeholder="e.g. IMAX SM Aura — Director's Club"
                className="h-9 bg-neutral-950 border-neutral-800"
              />
            </div>

            {/* Voting Date & Time Choices Manager */}
            <div className="space-y-4 pt-6 border-t border-neutral-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-green-400 uppercase tracking-wider">
                  Voting Date &amp; Time Choices
                </label>
                <span className="text-xs text-neutral-500">
                  {votingDates.length} options
                </span>
              </div>

              {/* Add Date + Time Option */}
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
                <div className="text-xs text-neutral-400 uppercase tracking-wider">
                  Add Date &amp; Showtime Slot
                </div>
                <div className="flex flex-wrap sm:flex-nowrap items-end gap-3">
                  <div className="space-y-1 flex-1 min-w-[140px]">
                    <label className="text-xs text-neutral-500">Date</label>
                    <Input
                      type="date"
                      value={newChoiceDate}
                      onChange={(e) => setNewChoiceDate(e.target.value)}
                      className="bg-neutral-900 border-neutral-800 text-white"
                    />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[120px]">
                    <label className="text-xs text-neutral-500">
                      Time (Optional)
                    </label>
                    <Input
                      type="time"
                      value={newChoiceTime}
                      onChange={(e) => setNewChoiceTime(e.target.value)}
                      className="bg-neutral-900 border-neutral-800 text-white"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddDateChoice}
                    className="bg-green-600 hover:bg-green-500 text-white shrink-0"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Slot
                  </Button>
                </div>

                {/* Add Custom Text Choice */}
                <div className="pt-3 border-t border-neutral-900 flex gap-2">
                  <Input
                    value={newCustomChoice}
                    onChange={(e) => setNewCustomChoice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomChoice();
                      }
                    }}
                    placeholder="Or add custom choice (e.g. Too early, let's settle closer to Dec)"
                    className="bg-neutral-900 border-neutral-800 text-white flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddCustomChoice}
                    className="shrink-0"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Custom
                  </Button>
                </div>
              </div>

              {/* Existing Choices List */}
              <div className="space-y-2">
                {votingDates.map((choice, idx) => {
                  const parsed = parseDateChoice(choice);
                  const votes = getVoteCount(choice);
                  const isWinning = appState?.winning_date === choice;

                  return (
                    <div
                      key={`${idx}-${choice}`}
                      className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3 rounded-xl border ${
                        isWinning
                          ? "bg-green-950/20 border-green-500/50"
                          : "bg-neutral-950 border-neutral-800"
                      }`}
                    >
                      {parsed.isDate ? (
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1">
                          <Input
                            type="date"
                            value={parsed.date}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleUpdateChoiceAtIndex(
                                  idx,
                                  buildDateChoice(e.target.value, parsed.time24)
                                );
                              }
                            }}
                            className="bg-neutral-900 border-neutral-800 text-white w-40"
                          />
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <Input
                              type="time"
                              value={parsed.time24}
                              onChange={(e) => {
                                handleUpdateChoiceAtIndex(
                                  idx,
                                  buildDateChoice(parsed.date, e.target.value)
                                );
                              }}
                              className="bg-neutral-900 border-neutral-800 text-green-400 w-32"
                              title="Set or update time for this date"
                            />
                            {parsed.time24 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateChoiceAtIndex(idx, parsed.date)
                                }
                                className="text-xs text-neutral-500 hover:text-neutral-300 px-1"
                                title="Clear time"
                              >
                                ×
                              </button>
                            )}
                          </div>
                          <span className="text-xs text-neutral-500 truncate">
                            ({choice})
                          </span>
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <Input
                            defaultValue={choice}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val && val !== choice) {
                                handleUpdateChoiceAtIndex(idx, val);
                              }
                            }}
                            className="bg-neutral-900 border-neutral-800 text-neutral-200 w-full"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                          {votes} {votes === 1 ? "vote" : "votes"}
                        </span>
                        <Button
                          type="button"
                          size="xs"
                          variant={isWinning ? "default" : "outline"}
                          onClick={() => updateAppState("winning_date", choice)}
                          title="Set as Winning Date & Time"
                        >
                          <Trophy className="w-3 h-3 mr-1" />
                          {isWinning ? "Winner" : "Set Winner"}
                        </Button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="destructive"
                          onClick={() => handleDeleteChoiceAtIndex(idx)}
                          title="Delete Choice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {votingDates.length === 0 && (
                  <div className="text-center text-sm text-neutral-600 py-4">
                    No voting choices configured yet. Add one above!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "seats" && (
        <div className="space-y-8">
          <div className="bg-neutral-900/70 p-6 rounded-xl border border-neutral-800 flex flex-wrap items-end gap-4 max-w-xl">
            <div className="space-y-1.5 flex-1 min-w-[100px]">
              <label className="text-xs text-neutral-400 uppercase">
                Row Label
              </label>
              <Input
                value={seatConfig.rowLabel}
                onChange={(e) =>
                  setSeatConfig({
                    ...seatConfig,
                    rowLabel: e.target.value.toUpperCase(),
                  })
                }
                className="bg-neutral-950 border-neutral-800"
                maxLength={2}
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[100px]">
              <label className="text-xs text-neutral-400 uppercase">
                Seat Count
              </label>
              <Input
                type="number"
                value={seatConfig.count}
                onChange={(e) =>
                  setSeatConfig({
                    ...seatConfig,
                    count: parseInt(e.target.value) || 1,
                  })
                }
                className="bg-neutral-950 border-neutral-800"
                min={1}
              />
            </div>
            <Button
              onClick={generateSeatsRow}
              className="bg-green-600 hover:bg-green-500 text-white"
            >
              <Plus className="w-4 h-4 mr-1" /> Generate Row
            </Button>
          </div>

          <div className="space-y-4">
            {Array.from(new Set(seats.map((s) => String(s.row_label))))
              .sort()
              .map((row) => (
                <div
                  key={String(row)}
                  className="bg-neutral-900/70 p-4 rounded-xl border border-neutral-800 flex items-center justify-between gap-4 overflow-x-auto"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-bold w-8 text-center text-green-400">
                      {String(row)}
                    </div>
                    <div className="flex gap-2">
                      {seats
                        .filter((s) => s.row_label === row)
                        .map((seat) => (
                          <div key={String(seat.id)} className="relative group">
                            <div
                              className={`w-12 h-12 flex items-center justify-center rounded-lg border text-xs font-bold ${
                                seat.status === "space"
                                  ? "bg-transparent border-dashed border-neutral-800 text-neutral-700"
                                  : seat.status === "unavailable"
                                  ? "bg-neutral-950 border-neutral-800 text-neutral-700"
                                  : seat.status === "occupied"
                                  ? "bg-blue-950/60 border-blue-500/50 text-blue-300"
                                  : "bg-green-950/30 border-green-500/40 text-green-400"
                              }`}
                            >
                              {String(seat.seat_number)}
                            </div>

                            {/* Admin Tools Hover */}
                            <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-neutral-950 border border-neutral-700 rounded-md p-1 hidden group-hover:flex gap-1 z-10 shadow-xl">
                              <button
                                onClick={() =>
                                  toggleSeatStatus(
                                    String(seat.id),
                                    String(seat.status),
                                    "space"
                                  )
                                }
                                className="px-1.5 py-0.5 hover:bg-neutral-800 rounded text-[10px] whitespace-nowrap text-blue-400"
                                title="Toggle Aisle Space"
                              >
                                Aisle
                              </button>
                              <button
                                onClick={() =>
                                  toggleSeatStatus(
                                    String(seat.id),
                                    String(seat.status)
                                  )
                                }
                                className="px-1.5 py-0.5 hover:bg-neutral-800 rounded text-[10px] whitespace-nowrap"
                                title="Toggle Available/Unavailable"
                              >
                                {seat.status === "unavailable"
                                  ? "Enable"
                                  : "Block"}
                              </button>
                              {seat.status === "occupied" && (
                                <button
                                  onClick={() =>
                                    toggleSeatStatus(
                                      String(seat.id),
                                      String(seat.status),
                                      "free"
                                    )
                                  }
                                  className="px-1.5 py-0.5 hover:bg-neutral-800 rounded text-[10px] whitespace-nowrap text-amber-400"
                                  title="Unassign Seat"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteSeat(String(seat.id))}
                                className="p-1 hover:bg-red-900/50 text-red-400 rounded"
                                title="Delete Seat"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            {seat.status === "occupied" && (
                              <div className="text-[10px] text-center mt-1 text-neutral-400 truncate w-12">
                                {String(
                                  (seat.users as Record<string, unknown>)?.name
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>

                  <Button
                    size="xs"
                    variant="destructive"
                    onClick={() => deleteRow(String(row))}
                    className="shrink-0"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Delete Row
                  </Button>
                </div>
              ))}
          </div>
        </div>
      )}

      <Toaster theme="dark" position="top-center" />
    </div>
  );
}
