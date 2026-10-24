"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUser } from "@/lib/UserContext";

const DEFAULT_VOTING_OPTIONS = [
  "2026-12-18",
  "2026-12-19",
  "2026-12-20",
  "Too early, let's settle this closer to December.",
];

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
  const [selectedDates, setSelectedDates] = useState<string[]>(user?.voted_dates || []);

  useEffect(() => {
    if (Array.isArray(appState?.voting_dates)) {
      setVotingOptions(appState.voting_dates as string[]);
      return;
    }

    async function fetchDates() {
      const { data } = await supabase.from("app_state").select("voting_dates").eq("id", 1).single();
      if (data && data.voting_dates) {
        setVotingOptions(data.voting_dates);
      } else {
        setVotingOptions(DEFAULT_VOTING_OPTIONS);
      }
    }
    fetchDates();
  }, [appState?.voting_dates]);

  const handleDateChange = (date: string) => {
    setSelectedDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const onSubmit = async () => {
    if (!user) return;
    if (selectedDates.length === 0) {
      toast.error("Please select at least one date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ voted_dates: selectedDates })
        .eq('id', user.id);

      if (error) throw error;

      setUser({ ...user, voted_dates: selectedDates });
      toast.success("Dates saved successfully!");
      onComplete();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save dates");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 pt-12">
      <header className="mb-12 text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-green-500 uppercase tracking-tighter">Avengers: Doomsday &mdash; Squad Booking</h1>
        <p className="text-lg text-neutral-300">
          We&apos;re catching Doomsday together in December! Because holiday cinema seats sell out in minutes, we&apos;re securing a single block of seats so we can all sit together.
        </p>
      </header>

      <div className="space-y-12">
        <section className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl">
          <h2 className="text-2xl font-bold mb-4 text-green-400">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-neutral-300">
            <li><strong className="text-white">Pick your dates.</strong> Vote for all the days &amp; times you are free.</li>
            <li><strong className="text-white">Confirm the date.</strong> Once majority decides, verify you can make the winning date.</li>
            <li><strong className="text-white">Chip in your ticket.</strong> Once the date is locked, send funds and upload receipt.</li>
            <li><strong className="text-white">Pick your seat later.</strong> Everyone who funded a ticket gets early access to pick their exact chair on our custom theater map.</li>
          </ol>
        </section>

        <section className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl">
          <h2 className="text-2xl font-bold mb-6 text-green-400">Step 1: Vote for Dates &amp; Times</h2>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Vote for all slots you are available</Label>
              <div className="grid gap-2">
                {votingOptions.map((date) => (
                  <label key={date} className="flex items-center space-x-3 bg-neutral-950 p-3 rounded-lg border border-neutral-800 hover:border-green-500/50 cursor-pointer transition-colors">
                    <input type="checkbox" className="form-checkbox text-green-500 bg-neutral-900 border-neutral-700 rounded focus:ring-green-500 focus:ring-offset-neutral-950 h-5 w-5" checked={selectedDates.includes(date)} onChange={() => handleDateChange(date)} />
                    <span className="text-neutral-200">{date}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={onSubmit} disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-6">
              {isSubmitting ? "Saving..." : "Save My Dates"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
