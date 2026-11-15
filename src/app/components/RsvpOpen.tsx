"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/UserContext";
import { Calendar, Check, Clock, MapPin, Users } from "lucide-react";

const DEFAULT_VOTING_OPTIONS = [
  "2026-12-19",
  "2026-12-20",
];
const TOO_EARLY_OPTION = "Too early to decide";
const UNAVAILABLE_OPTION = "I'm not available on all these dates";
const SPECIAL_VOTING_OPTIONS = [TOO_EARLY_OPTION, UNAVAILABLE_OPTION];
const FALLBACK_MOVIE_SCHEDULES: MovieSchedule[] = [
  ...["2026-12-16", "2026-12-17", "2026-12-18", "2026-12-19", "2026-12-20", "2026-12-21", "2026-12-22"].flatMap(
    (show_date) => [
      ...[
        ["Cinema 1", "10:30"],
        ["Cinema 3", "12:00"],
        ["Cinema 1", "13:50"],
        ["Cinema 4", "16:00"],
        ["Cinema 1", "17:10"],
        ["Cinema 2", "20:00"],
        ["Cinema 1", "20:30"],
      ].map(([cinema, showtime], index) => ({
        id: `fallback-north-${show_date}-${index}`,
        venue: "Robinsons North Tacloban",
        show_date,
        cinema,
        showtime,
        booked_seats: 0,
        total_seats: 100,
      })),
      ...[
        ["Cinema 4", "12:00"],
        ["Cinema 4", "15:30"],
        ["Cinema 4", "19:00"],
      ].map(([cinema, showtime], index) => ({
        id: `fallback-marasbaras-${show_date}-${index}`,
        venue: "Robinsons Marasbaras",
        show_date,
        cinema,
        showtime,
        booked_seats: 0,
        total_seats: 100,
      })),
    ]
  ),
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

function buildSeatPreview(scheduleId: string): MovieScheduleSeat[] {
  return "ABCDEFGHIJKLMNO".split("").flatMap((rowLabel) => {
    const lowerSection = rowLabel >= "I";
    const seatCount = lowerSection ? 20 : 19;
    const aislePositions = lowerSection ? [7, 14] : [6, 14];
    return Array.from({ length: seatCount }, (_, index) => ({
      id: `preview-${scheduleId}-${rowLabel}-${index + 1}`,
      schedule_id: scheduleId,
      row_label: rowLabel,
      seat_number: index + 1,
      status: aislePositions.includes(index + 1)
        ? ("space" as const)
        : ("available" as const),
    }));
  });
}

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

function formatTime12h(time24: string): string {
  const [hourText, minute] = time24.slice(0, 5).split(":");
  let hour = Number(hourText);
  if (!Number.isFinite(hour) || !minute) return time24;
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${period}`;
}


function isWeekendDate(dateValue: string): boolean {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isEligibleVotingSchedule(schedule: MovieSchedule): boolean {
  return Boolean(schedule.show_date && schedule.showtime);
}

function formatDateOption(dateValue: string): string {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const [configuredScheduleIds, setConfiguredScheduleIds] = useState<
    Set<string>
  >(new Set());
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>(
    user?.voted_schedule_ids || []
  );
  const [selectedVotingDate, setSelectedVotingDate] = useState("");
  const [selectedSpecialOption, setSelectedSpecialOption] = useState("");
  const [previewVenue, setPreviewVenue] = useState("");
  const [previewDate, setPreviewDate] = useState("");
  const [movieMapScheduleId, setMovieMapScheduleId] = useState("");
  const [movieMapSeats, setMovieMapSeats] = useState<MovieScheduleSeat[]>([]);

  useEffect(() => {
    if (user?.voted_dates) {
      setSelectedDates(user.voted_dates);
      setSelectedSpecialOption(
        user.voted_dates.find((option) =>
          SPECIAL_VOTING_OPTIONS.includes(option)
        ) || ""
      );
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
      const { data: configuredSeats, error: seatError } = await supabase
        .from("movie_schedule_seats")
        .select("schedule_id, status")
        .eq("status", "reserved");
      if (seatError) {
        console.error("Error fetching configured MovieWorld seats:", seatError);
        return;
      }
      const configuredScheduleIds = new Set(
        (configuredSeats || []).map((seat) => seat.schedule_id)
      );
      setSchedules(loaded);
      setConfiguredScheduleIds(configuredScheduleIds);
      setPreviewVenue(
        (current) => current || loaded[0]?.venue || ""
      );
      setPreviewDate(
        (current) => current || loaded[0]?.show_date || ""
      );
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
    const seatChannel = supabase
      .channel("public:movie_schedule_seats:rsvp")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movie_schedule_seats" },
        fetchSchedules
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(seatChannel);
    };
  }, []);

  useEffect(() => {
    const visibleSchedules = schedules.filter(
      (schedule) =>
        configuredScheduleIds.has(schedule.id) &&
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
      const configuredSeats = (data || []) as MovieScheduleSeat[];
      const configuredByPosition = new Map(
        configuredSeats.map((seat) => [
          `${seat.row_label}:${seat.seat_number}`,
          seat,
        ])
      );
      setMovieMapSeats(
        buildSeatPreview(scheduleId).map(
          (seat) =>
            configuredByPosition.get(`${seat.row_label}:${seat.seat_number}`) ||
            seat
        )
      );
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
  }, [
    movieMapScheduleId,
    previewDate,
    previewVenue,
    schedules,
    configuredScheduleIds,
  ]);

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
    if (
      weekendSchedules.length > 0 &&
      selectedScheduleIds.length === 0 &&
      !selectedSpecialOption
    ) {
      toast.error("Please select a date/showtime or one of the alternative options.");
      return;
    }
    if (weekendSchedules.length === 0 && selectedDates.length === 0) {
      toast.error("Please select at least one option.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedScheduleLabels = (schedules.length > 0
        ? schedules
        : FALLBACK_MOVIE_SCHEDULES)
        .filter(
          (schedule) =>
            isEligibleVotingSchedule(schedule) &&
            selectedScheduleIds.includes(schedule.id)
        )
        .map(formatSchedule);
      const submittedScheduleLabels = selectedSpecialOption
        ? []
        : selectedScheduleLabels;
      const submittedVotes = selectedSpecialOption
        ? [selectedSpecialOption]
        : submittedScheduleLabels;
      const { error } = await supabase
        .from("users")
        .update({
          voted_dates:
            weekendSchedules.length > 0 ? submittedVotes : selectedDates,
          voted_schedule_ids:
            weekendSchedules.length > 0
              ? selectedSpecialOption
                ? []
                : selectedScheduleIds
              : user.voted_schedule_ids,
        })
        .eq("id", user.id);

      if (error) throw error;

      setUser({
        ...user,
        voted_dates:
          weekendSchedules.length > 0 ? submittedVotes : selectedDates,
        voted_schedule_ids:
          weekendSchedules.length > 0
            ? selectedSpecialOption
              ? []
              : selectedScheduleIds
            : user.voted_schedule_ids,
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

  const rescindVote = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ voted_dates: [], voted_schedule_ids: [] })
        .eq("id", user.id);
      if (error) throw error;
      setSelectedDates([]);
      setSelectedScheduleIds([]);
      setSelectedSpecialOption("");
      setUser({ ...user, voted_dates: [], voted_schedule_ids: [] });
      toast.success("Your vote was rescinded. You can vote again.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to rescind vote");
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
  const votingSchedules = schedules;
  const weekendSchedules = votingSchedules.filter(isEligibleVotingSchedule);
  const weekendDates = Array.from(
    new Set(weekendSchedules.map((schedule) => schedule.show_date))
  ).sort();
  const activeVotingDate =
    selectedVotingDate && weekendDates.includes(selectedVotingDate)
      ? selectedVotingDate
      : "";
  const schedulesForVotingDate = weekendSchedules.filter(
    (schedule) => schedule.show_date === activeVotingDate
  );
  const selectedSchedulesForVotingDate = schedulesForVotingDate.filter(
    (schedule) => selectedScheduleIds.includes(schedule.id)
  );
  const legacyWeekendOptions = [
    ...votingOptions.filter((option) => {
    const dateMatch = option.match(/^\d{4}-\d{2}-\d{2}/);
    return dateMatch ? isWeekendDate(dateMatch[0]) : false;
    }),
    ...SPECIAL_VOTING_OPTIONS.filter((option) => !votingOptions.includes(option)),
  ];
  const hasSpecificVote =
    selectedScheduleIds.length > 0 && !selectedSpecialOption;
  const hasSameScheduleSelection =
    selectedScheduleIds.length === savedScheduleIds.length &&
    selectedScheduleIds.every((id) => savedScheduleIds.includes(id));
  const hasUnsavedVote =
    (hasSpecificVote && !hasSameScheduleSelection) ||
    (!hasSpecificVote && savedScheduleIds.length > 0) ||
    selectedSpecialOption !==
      (savedDates.find((option) => SPECIAL_VOTING_OPTIONS.includes(option)) || "");
  const venues = Array.from(new Set(schedules.map((schedule) => schedule.venue)));
  const configuredSchedules = schedules.filter((schedule) =>
    configuredScheduleIds.has(schedule.id)
  );
  const previewDates = Array.from(
    new Set(
      configuredSchedules
        .filter((schedule) => schedule.venue === previewVenue)
        .map((schedule) => schedule.show_date)
    )
  );
  const effectivePreviewDate = previewDate || previewDates[0] || "";
  const previewSchedules = useMemo(
    () =>
      configuredSchedules.filter(
        (schedule) =>
          schedule.venue === previewVenue &&
          schedule.show_date === effectivePreviewDate
      ),
    [configuredSchedules, previewVenue, effectivePreviewDate]
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
    ...legacyWeekendOptions.map(
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
              Pwede kamo mag pa book haak (with receipt &amp; seat map), or{" "}
              <span className="text-neutral-200 font-medium">
                book your own tickets on the MovieWorld website
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

      {weekendSchedules.length === 0 && (
        <section className="bg-neutral-900/60 border border-neutral-800/90 p-5 sm:p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white">
            Showtimes are being configured
          </h2>
          <p className="text-sm text-neutral-400 mt-2">
            Dates and times will appear here once unavailable MovieWorld seats
            have been marked by the admin.
          </p>
        </section>
      )}

      {weekendSchedules.length > 0 && (
        <>
          <section className="bg-neutral-900/60 border border-neutral-800/90 p-5 sm:p-6 rounded-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">
                  When and where are we watching?
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  First choose a weekend date, then choose the venue and showtime
                  that works for you.
                </p>
              </div>
              <MapPin className="w-5 h-5 text-green-400 shrink-0" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
                1. Choose a date
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {weekendDates.map((date) => {
                  const dateSchedules = weekendSchedules.filter(
                    (schedule) => schedule.show_date === date
                  );
                  const dateVoteCount = dateSchedules.reduce(
                    (count, schedule) => count + scheduleVotes(schedule.id),
                    0
                  );
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => {
                        setSelectedVotingDate(date);
                        setSelectedSpecialOption("");
                      }}
                      className={`text-left p-4 rounded-xl border transition-colors ${
                        activeVotingDate === date
                          ? "bg-green-500/10 border-green-500/50"
                          : "bg-neutral-950/80 border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-neutral-100">
                          {formatDateOption(date)}
                        </span>
                        <span className="text-xs font-mono text-neutral-400">
                          {dateVoteCount} votes
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {dateSchedules.length} showtime
                        {dateSchedules.length === 1 ? "" : "s"} available
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
                Alternative responses
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SPECIAL_VOTING_OPTIONS.map((option) => {
                  const isSelected = selectedSpecialOption === option;
                  const votes = kirigtaVoters.filter((voter) =>
                    voter.voted_dates?.includes(option)
                  ).length;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setSelectedSpecialOption(isSelected ? "" : option);
                        if (!isSelected) {
                          setSelectedScheduleIds([]);
                        }
                      }}
                      className={`text-left p-4 rounded-xl border transition-colors ${
                        isSelected
                          ? "bg-amber-500/10 border-amber-500/50"
                          : "bg-neutral-950/80 border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-neutral-100">
                          {option}
                        </span>
                        <span className="text-xs font-mono text-neutral-400">
                          {votes} votes
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        This is an alternative to selecting a specific showtime.
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
                2. Choose a time slot
              </div>
              <div className="space-y-3">
                {selectedVotingDate && schedulesForVotingDate.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {schedulesForVotingDate.map((schedule) => {
                        const isSelected = selectedScheduleIds.includes(
                          schedule.id
                        );
                        return (
                          <button
                            key={schedule.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedSpecialOption("");
                              setSelectedScheduleIds((current) =>
                                isSelected
                                  ? current.filter((id) => id !== schedule.id)
                                  : [...current, schedule.id]
                              );
                            }}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors min-h-12 ${
                              isSelected
                                ? "border-green-500/60 bg-green-500/10"
                                : "border-neutral-800 bg-neutral-950/80 hover:border-neutral-700"
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                isSelected
                                  ? "border-green-400 bg-green-500 text-neutral-950"
                                  : "border-neutral-700 text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-neutral-100">
                                {schedule.venue.replace("Robinsons ", "")}
                              </span>
                              <span className="block text-xs text-neutral-400 mt-0.5">
                                {schedule.cinema} ·{" "}
                                {formatTime12h(schedule.showtime)}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedSchedulesForVotingDate.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-neutral-500">
                          Selected time slot
                          {selectedSchedulesForVotingDate.length > 1 ? "s" : ""}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedSchedulesForVotingDate.map((schedule) => (
                            <button
                              key={schedule.id}
                              type="button"
                              onClick={() =>
                                setSelectedScheduleIds((current) =>
                                  current.filter((id) => id !== schedule.id)
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2 py-1 text-[11px] text-green-200 hover:bg-green-500/20"
                              title={`Remove ${schedule.venue} ${schedule.cinema} ${formatTime12h(schedule.showtime)}`}
                            >
                              <span>
                                {schedule.venue.replace("Robinsons ", "")} ·{" "}
                                {schedule.cinema} · {formatTime12h(schedule.showtime)}
                              </span>
                              <span className="text-green-400">×</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
                {!selectedVotingDate && (
                  <div className="rounded-xl border border-dashed border-neutral-800 p-5 text-sm text-neutral-500">
                    Select a date above to see its available time slots.
                  </div>
                )}
                {selectedVotingDate && schedulesForVotingDate.length === 0 && (
                  <div className="rounded-xl border border-dashed border-neutral-800 p-5 text-sm text-neutral-500">
                    No showtimes are configured for this weekend date yet.
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <span className="text-xs text-neutral-400">
                {selectedSpecialOption
                  ? selectedSpecialOption
                  : selectedScheduleIds.length > 0 &&
                    !hasUnsavedScheduleChanges
                  ? `Your choices are saved (${selectedScheduleIds.length} selected)`
                  : `${selectedScheduleIds.length} selected`}
              </span>
              <Button
                onClick={onSubmit}
                disabled={
                  isSubmitting ||
                  (selectedScheduleIds.length === 0 && !selectedSpecialOption)
                }
                className="w-full sm:w-auto min-w-[180px] h-11 bg-green-600 hover:bg-green-500 text-white font-semibold"
              >
                {isSubmitting
                  ? "Saving..."
                  : !hasUnsavedVote
                  ? "Choices Saved"
                  : "Save My Choices"}
              </Button>
              {savedDates.length > 0 || savedScheduleIds.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={rescindVote}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-11 border-red-500/40 text-red-300 hover:bg-red-500/10"
                >
                  Rescind My Vote
                </Button>
              ) : null}
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
                        {formatTime12h(schedule.showtime)}
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
                                  {schedule.cinema} · {formatTime12h(schedule.showtime)}
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
      {false && (
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
          {legacyWeekendOptions.map((option) => {
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
