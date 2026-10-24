"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/UserContext";
import { Calendar, Check, Clock, Users } from "lucide-react";

const DEFAULT_VOTING_OPTIONS = [
  "2026-12-18",
  "2026-12-19",
  "2026-12-20",
  "Too early, let's settle this closer to December.",
];

type SquadVoter = {
  id: string;
  name: string;
  avatar_url: string;
  voted_dates: string[] | null;
};

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
  const [squadVoters, setSquadVoters] = useState<SquadVoter[]>([]);

  useEffect(() => {
    if (user?.voted_dates) {
      setSelectedDates(user.voted_dates);
    }
  }, [user?.voted_dates]);

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
        .select("id, name, avatar_url, voted_dates")
        .order("created_at", { ascending: true });
      if (data) setSquadVoters(data as SquadVoter[]);
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
    if (selectedDates.length === 0) {
      toast.error("Please select at least one option.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ voted_dates: selectedDates })
        .eq("id", user.id);

      if (error) throw error;

      setUser({ ...user, voted_dates: selectedDates });
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

  // Find max votes to highlight leading slot
  const maxVotes = Math.max(
    0,
    ...votingOptions.map(
      (opt) =>
        squadVoters.filter(
          (v) => Array.isArray(v.voted_dates) && v.voted_dates.includes(opt)
        ).length
    )
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 space-y-10">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-green-400">
          <Calendar className="w-3.5 h-3.5" /> Phase 1 {"//"} Schedule Poll
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          When are we watching Doomsday?
        </h1>
        <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
          Holiday cinema blocks sell out fast. Select every date &amp; showtime
          you can make so we can lock in a single block of seats together.
        </p>
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

      {/* Voting Card */}
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
              {squadVoters.filter((v) => (v.voted_dates?.length || 0) > 0).length}{" "}
              / {squadVoters.length} voted
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {votingOptions.map((option) => {
            const isChecked = selectedDates.includes(option);
            const votersForOption = squadVoters.filter(
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
    </div>
  );
}
