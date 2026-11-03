"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/UserContext";
import { Calendar, Check, Clock, MapPin, Users } from "lucide-react";

const DEFAULT_VOTING_OPTIONS = [
  "2026-12-18",
  "2026-12-19",
  "2026-12-20",
  "Too early, let's settle this closer to December.",
];

type kirigtaVoter = {
  id: string;
  name: string;
  avatar_url: string;
  voted_dates: string[] | null;
  voted_schedule_ids: string[] | null;
};

type MovieSchedule = {
  id: string;
  venue: string;
  show_date: string;
  cinema: string;
  showtime: string;
  booked_seats: number;
  total_seats: number;
};

type MovieScheduleSeat = {
  id: string;
  schedule_id: string;
  row_label: string;
  seat_number: number;
  status: "available" | "reserved" | "space";
};

function formatSchedule(schedule: MovieSchedule) {
  const date = new Date(`${schedule.show_date}T00:00:00`);
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const [hourText, minute] = schedule.showtime.slice(0, 5).split(":");
  let hour = Number(hourText);
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${dateLabel} • ${schedule.cinema} • ${hour}:${minute} ${period}`;
}

function formatSlotDisplay(slot: string): {
  title: string;
  subtitle?: string;
  timeBadge?: string;
} {
  const match = slot
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:\s*(?:•|@|-|\|)\s*(.+))?$/);
  if (!match) {
    return { title: slot };
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const timePart = match[4]?.trim();

  const dateObj = new Date(year, month, day);
  if (isNaN(dateObj.getTime())) {
    return { title: slot };
  }

  const formattedDate = dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return {
    title: formattedDate,
    subtitle: `${match[1]}-${match[2]}-${match[3]}`,
    timeBadge: timePart || undefined,
  };
}

export default function RsvpOpen({
  appState,
  onComplete,
}: {
  appState?: Record<string, unknown> | null;
  onComplete: () => void;
}) {
  const { user, setUser } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [votingOptions, setVotingOptions] = useState<string[]>(
    (appState?.voting_dates as string[]) || DEFAULT_VOTING_OPTIONS
  );
  const [selectedDates, setSelectedDates] = useState<string[]>(
    user?.voted_dates || []
  );
  const [kirigtaVoters, setkirigtaVoters] = useState<kirigtaVoter[]>([]);
  const [schedules, setSchedules] = useState<MovieSchedule[]>([]);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>(
    user?.voted_schedule_ids || []
  );
  const [previewVenue, setPreviewVenue] = useState("");
  const [previewDate, setPreviewDate] = useState("");
  const [movieMapScheduleId, setMovieMapScheduleId] = useState("");
  const [movieMapSeats, setMovieMapSeats] = useState<MovieScheduleSeat[]>([]);

  useEffect(() => {
    if (user?.voted_dates) {
      setSelectedDates(user.voted_dates);
    }
  }, [user?.voted_dates]);

  useEffect(() => {
    setSelectedScheduleIds(user?.voted_schedule_ids || []);
  }, [user?.voted_schedule_ids]);

  useEffect(() => {
    async function fetchSchedules() {
      const { data, error } = await supabase
        .from("movie_schedules")
        .select(
          "id, venue, show_date, cinema, showtime, booked_seats, total_seats"
        )
        .order("show_date")
        .order("showtime");
      if (error) {
        console.error("Error fetching movie schedules:", error);
        return;
      }
      const loaded = (data || []) as MovieSchedule[];
      setSchedules(loaded);
      setPreviewVenue((current) => current || loaded[0]?.venue || "");
      setPreviewDate((current) => current || loaded[0]?.show_date || "");
    }
    fetchSchedules();

    const channel = supabase
      .channel("public:movie_schedules:rsvp")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movie_schedules" },
        fetchSchedules
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const visibleSchedules = schedules.filter(
      (schedule) =>
        schedule.venue === previewVenue &&
        schedule.show_date ===
          (previewDate ||
            Array.from(
              new Set(
                schedules
                  .filter((item) => item.venue === previewVenue)
                  .map((item) => item.show_date)
              )
            )[0] ||
            "")
    );
    const scheduleId =
      visibleSchedules.some((schedule) => schedule.id === movieMapScheduleId)
        ? movieMapScheduleId
        : visibleSchedules[0]?.id || "";
    if (!scheduleId) {
      setMovieMapSeats([]);
      return;
    }
    setMovieMapScheduleId((current) => current || scheduleId);
    async function fetchMovieMap() {
      const { data, error } = await supabase
        .from("movie_schedule_seats")
        .select("id, schedule_id, row_label, seat_number, status")
        .eq("schedule_id", scheduleId)
        .order("row_label")
        .order("seat_number");
      if (error) {
        console.error("Error fetching MovieWorld seat map:", error);
        return;
      }
      setMovieMapSeats((data || []) as MovieScheduleSeat[]);
    }
    fetchMovieMap();
    const channel = supabase
      .channel(`public:movie_schedule_seats:${scheduleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "movie_schedule_seats",
          filter: `schedule_id=eq.${scheduleId}`,
        },
        fetchMovieMap
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [movieMapScheduleId, previewDate, previewVenue, schedules]);

  useEffect(() => {
    if (Array.isArray(appState?.voting_dates)) {
      setVotingOptions(appState.voting_dates as string[]);
      return;
    }

    async function fetchDates() {
      const { data } = await supabase
        .from("app_state")
        .select("voting_dates")
        .eq("id", 1)
        .single();
      if (data && data.voting_dates) {
        setVotingOptions(data.voting_dates);
      } else {
        setVotingOptions(DEFAULT_VOTING_OPTIONS);
      }
    }
    fetchDates();
  }, [appState?.voting_dates]);

  useEffect(() => {
    async function fetchVoters() {
      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url, voted_dates, voted_schedule_ids")
        .order("created_at", { ascending: true });
      if (data) setkirigtaVoters(data as kirigtaVoter[]);
    }
    fetchVoters();

    const channel = supabase
      .channel("public:users:rsvp")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          fetchVoters();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDateChange = (date: string) => {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const onSubmit = async () => {
    if (!user) return;
    if (schedules.length > 0 && selectedScheduleIds.length === 0) {
      toast.error("Please select at least one venue and showtime.");
      return;
    }
    if (schedules.length === 0 && selectedDates.length === 0) {
      toast.error("Please select at least one option.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedScheduleLabels = schedules
        .filter((schedule) => selectedScheduleIds.includes(schedule.id))
        .map(formatSchedule);
      const { error } = await supabase
        .from("users")
        .update({
          voted_dates:
            schedules.length > 0 ? selectedScheduleLabels : selectedDates,
          voted_schedule_ids:
            schedules.length > 0 ? selectedScheduleIds : user.voted_schedule_ids,
        })
        .eq("id", user.id);

      if (error) throw error;

      setUser({
        ...user,
        voted_dates: schedules.length > 0 ? selectedScheduleLabels : selectedDates,
        voted_schedule_ids:
          schedules.length > 0 ? selectedScheduleIds : user.voted_schedule_ids,
      });
      toast.success("Availability saved!");
      onComplete();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save dates"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const savedDates = user?.voted_dates || [];
  const hasUnsavedChanges =
    selectedDates.length !== savedDates.length ||
    selectedDates.some((d) => !savedDates.includes(d));
  const savedScheduleIds = user?.voted_schedule_ids || [];
  const hasUnsavedScheduleChanges =
    selectedScheduleIds.length !== savedScheduleIds.length ||
    selectedScheduleIds.some((id) => !savedScheduleIds.includes(id));
  const scheduleVotes = (scheduleId: string) =>
    kirigtaVoters.filter((v) => v.voted_schedule_ids?.includes(scheduleId)).length;
  const venues = Array.from(new Set(schedules.map((schedule) => schedule.venue)));
  const previewDates = Array.from(
    new Set(
      schedules
        .filter((schedule) => schedule.venue === previewVenue)
        .map((schedule) => schedule.show_date)
    )
  );
  const effectivePreviewDate = previewDate || previewDates[0] || "";
  const previewSchedules = useMemo(
    () =>
      schedules.filter(
        (schedule) =>
          schedule.venue === previewVenue &&
          schedule.show_date === effectivePreviewDate
      ),
    [schedules, previewVenue, effectivePreviewDate]
  );
  const groupedSchedules = Array.from(
    schedules.reduce(
      (map, schedule) => {
        const key = `${schedule.venue}__${schedule.show_date}`;
        const current = map.get(key) || [];
        current.push(schedule);
        map.set(key, current);
        return map;
      },
      new Map<string, MovieSchedule[]>()
    )
  ).sort(([a], [b]) => a.localeCompare(b));
  const totalBookedSeats = schedules.reduce(
    (sum, schedule) => sum + schedule.booked_seats,
    0
  );
  const totalSeats = schedules.reduce(
    (sum, schedule) => sum + schedule.total_seats,
    0
  );
  const totalSeatsLeft = Math.max(totalSeats - totalBookedSeats, 0);

  // Find max votes to highlight leading slot
  const maxVotes = Math.max(
    0,
    ...votingOptions.map(
      (opt) =>
        kirigtaVoters.filter(
          (v) => Array.isArray(v.voted_dates) && v.voted_dates.includes(opt)
        ).length
    )
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 space-y-10">
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-green-400">
          <Calendar className="w-3.5 h-3.5" /> Phase 1 {"//"} Schedule Poll
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          When are we watching Doomsday?
        </h1>
        <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
          Nag start na an ticket selling for Doomsday, and hassle an hilaba nga
          pila ha screening day. Pili kita hin date based on majority vote—once
          locked in ngan <span className="text-white font-medium">G tanan</span>,
          we&apos;ll pool funds, book the block, and open the live seat map.
        </p>

        {/* Compact Briefing Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs leading-relaxed">
          <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-xl p-3.5 space-y-1">
            <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-green-400">
              Self-Book or Pool
            </div>
            <p className="text-neutral-400">
              Pwede kamo mag-book via me (with receipt &amp; seat map), or{" "}
              <span className="text-neutral-200 font-medium">
                book on your own
              </span>{" "}
              (recommended) once the date is final—I&apos;ll send the link.
            </p>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-xl p-3.5 space-y-1">
            <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Non-Refundable
            </div>
            <p className="text-neutral-400">
              Make sure available kamo before booking. Let me know early if you
              can&apos;t make it so we can adjust headcount—once pumalit na,{" "}
              <span className="text-neutral-200 font-medium">final na ito</span>.
            </p>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-xl p-3.5 space-y-1">
            <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-300">
              Too Early Pa?
            </div>
            <p className="text-neutral-400">
              Vote nala nga ha December kita palit. Check the MovieWorld seat
              preview page anytime para may idea kamo kun puno na o pwede pa
              maghulat.
            </p>
          </div>
        </div>
      </header>

      {/* Minimal 4-Step Overview Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { step: "01", title: "Vote Slots", desc: "Mark all dates you're free" },
          { step: "02", title: "Confirm", desc: "Lock final headcount" },
          { step: "03", title: "Chip In", desc: "Pool ticket funds" },
          { step: "04", title: "Pick Seat", desc: "Claim chair on live map" },
        ].map((item, idx) => (
          <div
            key={item.step}
            className={`p-3.5 rounded-xl border ${
              idx === 0
                ? "bg-green-500/5 border-green-500/30"
                : "bg-neutral-900/40 border-neutral-800/80"
            }`}
          >
            <div
              className={`text-[10px] font-mono font-bold mb-1 ${
                idx === 0 ? "text-green-400" : "text-neutral-500"
              }`}
            >
              STEP {item.step}
            </div>
            <div className="text-xs font-semibold text-neutral-200">
              {item.title}
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              {item.desc}
            </div>
          </div>
        ))}
      </div>

      {schedules.length > 0 && (
        <>
          <section className="bg-neutral-900/60 border border-neutral-800/90 p-5 sm:p-6 rounded-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">
                  When and where are we watching?
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Select every Robinsons venue and showtime that works for you.
                </p>
              </div>
              <MapPin className="w-5 h-5 text-green-400 shrink-0" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {schedules.map((schedule) => {
                const isChecked = selectedScheduleIds.includes(schedule.id);
                const votes = scheduleVotes(schedule.id);
                const remaining = Math.max(
                  schedule.total_seats - schedule.booked_seats,
                  0
                );
                return (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() =>
                      setSelectedScheduleIds((current) =>
                        isChecked
                          ? current.filter((id) => id !== schedule.id)
                          : [...current, schedule.id]
                      )
                    }
                    className={`text-left p-4 rounded-xl border transition-colors ${
                      isChecked
                        ? "bg-green-500/10 border-green-500/50"
                        : "bg-neutral-950/80 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3 min-w-0">
                        <div
                          className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center shrink-0 ${
                            isChecked
                              ? "bg-green-500 border-green-500 text-neutral-950"
                              : "border-neutral-700"
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-neutral-100">
                            {formatSchedule(schedule)}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">
                            {schedule.venue}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-neutral-400 shrink-0">
                        {votes} {votes === 1 ? "vote" : "votes"}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-neutral-500">
                      {remaining} of {schedule.total_seats} seats currently available
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <span className="text-xs text-neutral-400">
                {selectedScheduleIds.length > 0 && !hasUnsavedScheduleChanges
                  ? `Your choices are saved (${selectedScheduleIds.length} selected)`
                  : `${selectedScheduleIds.length} selected`}
              </span>
              <Button
                onClick={onSubmit}
                disabled={isSubmitting || selectedScheduleIds.length === 0}
                className="w-full sm:w-auto min-w-[180px] h-11 bg-green-600 hover:bg-green-500 text-white font-semibold"
              >
                {isSubmitting
                  ? "Saving..."
                  : !hasUnsavedScheduleChanges
                  ? "Choices Saved"
                  : "Save My Choices"}
              </Button>
            </div>
          </section>

          <section className="bg-neutral-900/60 border border-neutral-800/90 p-5 sm:p-6 rounded-2xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">
                MovieWorld seat preview
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Check the manually updated availability for a venue and date.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-neutral-400 space-y-1.5">
                <span className="block uppercase tracking-wider">Robinsons</span>
                <select
                  value={previewVenue}
                  onChange={(event) => {
                    setPreviewVenue(event.target.value);
                    setPreviewDate("");
                  }}
                  className="w-full rounded-md bg-neutral-950 border border-neutral-800 p-2.5 text-sm text-white"
                >
                  {venues.map((venue) => (
                    <option key={venue} value={venue}>
                      {venue}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-neutral-400 space-y-1.5">
                <span className="block uppercase tracking-wider">Date</span>
                <select
                  value={effectivePreviewDate}
                  onChange={(event) => setPreviewDate(event.target.value)}
                  className="w-full rounded-md bg-neutral-950 border border-neutral-800 p-2.5 text-sm text-white"
                >
                  {previewDates.map((date) => (
                    <option key={date} value={date}>
                      {new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {previewSchedules.map((schedule) => {
                const remaining = Math.max(
                  schedule.total_seats - schedule.booked_seats,
                  0
                );
                return (
                  <div
                    key={schedule.id}
                    className="p-4 rounded-xl bg-neutral-950 border border-neutral-800"
                  >
                    <div className="flex justify-between gap-3 text-sm text-neutral-200">
                      <span>{schedule.cinema}</span>
                      <span className="font-mono text-green-400">
                        {schedule.showtime.slice(0, 5)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-neutral-400">
                      {schedule.booked_seats} booked · {remaining} seats left
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${Math.min(
                            (schedule.booked_seats / schedule.total_seats) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setMovieMapScheduleId(schedule.id)}
                      className={`mt-3 text-xs underline ${
                        movieMapScheduleId === schedule.id
                          ? "text-green-400"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {movieMapScheduleId === schedule.id
                        ? "Showing seat map below"
                        : "View current seat map"}
                    </button>
                  </div>
                );
              })}
            </div>
            {movieMapSeats.length > 0 && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4 space-y-4 overflow-x-auto">
                <div className="text-center text-xs font-bold tracking-wider bg-neutral-200 text-neutral-900 py-2 min-w-[700px]">
                  MOVIE SCREEN
                </div>
                <div className="min-w-[700px] space-y-1">
                  {Array.from(
                    new Set(movieMapSeats.map((seat) => seat.row_label))
                  )
                    .sort()
                    .map((row) => (
                      <div key={row} className="flex items-center gap-2">
                        <span className="w-5 text-center text-xs font-bold text-neutral-400">
                          {row}
                        </span>
                        <div className="flex gap-1">
                          {movieMapSeats
                            .filter((seat) => seat.row_label === row)
                            .sort((a, b) => a.seat_number - b.seat_number)
                            .map((seat) => (
                              <span
                                key={seat.id}
                                title={`${row}${seat.seat_number}: ${seat.status}`}
                                className={`w-6 h-6 rounded text-[8px] flex items-center justify-center font-bold ${
                                  seat.status === "reserved"
                                    ? "bg-lime-400 text-neutral-950"
                                    : seat.status === "space"
                                    ? "border border-dashed border-neutral-700"
                                    : "bg-red-600/80 text-white"
                                }`}
                              >
                                {seat.status === "space"
                                  ? ""
                                  : seat.seat_number}
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-neutral-400 min-w-[700px]">
                  <span>
                    <i className="inline-block w-3 h-3 rounded bg-red-600/80 mr-1" />
                    Available
                  </span>
                  <span>
                    <i className="inline-block w-3 h-3 rounded bg-lime-400 mr-1" />
                    Reserved on MovieWorld
                  </span>
                  <span>
                    <i className="inline-block w-3 h-3 border border-dashed border-neutral-700 mr-1" />
                    Aisle/space
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className="bg-neutral-900/60 border border-neutral-800/90 p-5 sm:p-6 rounded-2xl space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Current bookings across all schedules
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Live reference for when we should start booking before seats run out.
                </p>
              </div>
              <div className="text-xs text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2">
                <span className="text-neutral-500">Total left:</span>{" "}
                <span className="text-green-400 font-semibold">
                  {totalSeatsLeft}
                </span>{" "}
                / {totalSeats}
              </div>
            </div>

            <div className="space-y-4">
              {groupedSchedules.map(([groupKey, group]) => {
                const [venue, showDate] = groupKey.split("__");
                const groupBooked = group.reduce(
                  (sum, schedule) => sum + schedule.booked_seats,
                  0
                );
                const groupTotal = group.reduce(
                  (sum, schedule) => sum + schedule.total_seats,
                  0
                );
                const groupLeft = Math.max(groupTotal - groupBooked, 0);

                return (
                  <div
                    key={groupKey}
                    className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-neutral-100">
                          {venue}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {new Date(`${showDate}T00:00:00`).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-300">
                        {groupBooked} booked · {groupLeft} left
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {group
                        .slice()
                        .sort((a, b) =>
                          `${a.showtime}-${a.cinema}`.localeCompare(
                            `${b.showtime}-${b.cinema}`
                          )
                        )
                        .map((schedule) => {
                          const left = Math.max(
                            schedule.total_seats - schedule.booked_seats,
                            0
                          );
                          const fillPercent = Math.min(
                            (schedule.booked_seats / schedule.total_seats) * 100,
                            100
                          );
                          const urgencyClass =
                            left <= 10
                              ? "text-red-300 border-red-500/40 bg-red-500/10"
                              : left <= 25
                              ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
                              : "text-green-300 border-green-500/30 bg-green-500/10";

                          return (
                            <div
                              key={schedule.id}
                              className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3"
                            >
                              <div className="flex justify-between gap-3 text-sm text-neutral-200">
                                <span>
                                  {schedule.cinema} · {schedule.showtime.slice(0, 5)}
                                </span>
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded border ${urgencyClass}`}
                                >
                                  {left} left
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-neutral-400">
                                {schedule.booked_seats} booked out of {schedule.total_seats}
                              </div>
                              <div className="mt-2 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                                <div
                                  className="h-full bg-green-500"
                                  style={{ width: `${fillPercent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Legacy date voting remains available until schedule rows are configured. */}
      {schedules.length === 0 && (
      /* Voting Card */
      <section className="bg-neutral-900/60 border border-neutral-800/90 p-5 sm:p-6 rounded-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-white">
              Select Your Available Slots
            </h2>
            <p className="text-xs text-neutral-400">
              Check all options that work for your schedule
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Users className="w-3.5 h-3.5 text-green-400" />
            <span>
              {kirigtaVoters.filter((v) => (v.voted_dates?.length || 0) > 0).length}{" "}
              / {kirigtaVoters.length} voted
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {votingOptions.map((option) => {
            const isChecked = selectedDates.includes(option);
            const votersForOption = kirigtaVoters.filter(
              (v) =>
                Array.isArray(v.voted_dates) && v.voted_dates.includes(option)
            );
            const isLeading =
              maxVotes > 0 && votersForOption.length === maxVotes;
            const display = formatSlotDisplay(option);

            return (
              <div
                key={option}
                onClick={() => handleDateChange(option)}
                className={`group flex items-center justify-between gap-4 p-4 rounded-xl border cursor-pointer transition-all select-none ${
                  isChecked
                    ? "bg-green-500/10 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.08)]"
                    : "bg-neutral-950/80 border-neutral-800/90 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                      isChecked
                        ? "bg-green-500 border-green-500 text-neutral-950"
                        : "bg-neutral-900 border-neutral-700 group-hover:border-neutral-500"
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          isChecked ? "text-white" : "text-neutral-200"
                        }`}
                      >
                        {display.title}
                      </span>
                      {display.timeBadge && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-700/80 text-green-400 text-xs font-mono">
                          <Clock className="w-3 h-3" />
                          {display.timeBadge}
                        </span>
                      )}
                      {isLeading && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-green-500/15 text-green-400 border border-green-500/30">
                          Top Pick
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Voter Avatars & Count */}
                <div className="flex items-center gap-2 shrink-0">
                  {votersForOption.length > 0 && (
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {votersForOption.slice(0, 5).map((voter) =>
                        voter.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            key={voter.id}
                            src={voter.avatar_url}
                            alt={voter.name}
                            title={voter.name}
                            className="inline-block w-6 h-6 rounded-full ring-2 ring-neutral-950 object-cover bg-neutral-800"
                          />
                        ) : (
                          <div
                            key={voter.id}
                            title={voter.name}
                            className="inline-flex w-6 h-6 rounded-full ring-2 ring-neutral-950 bg-neutral-800 text-[10px] font-bold text-neutral-300 items-center justify-center"
                          >
                            {voter.name.charAt(0).toUpperCase()}
                          </div>
                        )
                      )}
                    </div>
                  )}
                  <span className="text-xs font-mono text-neutral-400 min-w-[2.5rem] text-right">
                    {votersForOption.length}{" "}
                    {votersForOption.length === 1 ? "vote" : "votes"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-neutral-400">
            {savedDates.length > 0 && !hasUnsavedChanges ? (
              <span className="text-green-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Your votes are saved (
                {savedDates.length} selected)
              </span>
            ) : (
              <span>{selectedDates.length} selected</span>
            )}
          </div>

          <Button
            onClick={onSubmit}
            disabled={isSubmitting || selectedDates.length === 0}
            className="w-full sm:w-auto min-w-[180px] h-11 bg-green-600 hover:bg-green-500 text-white font-semibold"
          >
            {isSubmitting
              ? "Saving..."
              : savedDates.length > 0 && !hasUnsavedChanges
              ? "Votes Saved"
              : "Save My Votes"}
          </Button>
        </div>
      </section>
      )}
    </div>
  );
}
