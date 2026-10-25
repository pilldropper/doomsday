"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/UserContext";
import { CheckCircle2, XCircle, Clock, CalendarCheck } from "lucide-react";

type kirigtaMember = {
  id: string;
  name: string;
  avatar_url: string;
  is_available: boolean | null;
};

export default function DateConfirmation({
  appState,
}: {
  appState: Record<string, unknown> | null;
}) {
  const { user, setUser } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<kirigtaMember[]>([]);

  useEffect(() => {
    async function fetchMembers() {
      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url, is_available")
        .order("created_at", { ascending: true });
      if (data) setMembers(data as kirigtaMember[]);
    }
    fetchMembers();

    const channel = supabase
      .channel("public:users:confirm")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleConfirm = async (isAvailable: boolean) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("users")
        .update({ is_available: isAvailable })
        .eq("id", user.id);

      if (error) throw error;

      setUser({ ...user, is_available: isAvailable });
      toast.success(
        isAvailable
          ? "Locked in! You're on the roster."
          : "Response saved. Catch you next mission!"
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save confirmation"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const goingList = members.filter((m) => m.is_available === true);
  const outList = members.filter((m) => m.is_available === false);
  const pendingList = members.filter(
    (m) => m.is_available === null || m.is_available === undefined
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-12 space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-green-400">
          <CalendarCheck className="w-3.5 h-3.5" /> Phase 2 {"//"} Final Headcount
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Majority Date Selected
        </h2>
        <p className="text-sm text-neutral-400">
          Confirm whether you can make this exact date &amp; time before we start buying tickets.
        </p>
      </div>

      {/* Winning Date Banner */}
      <div className="p-6 sm:p-8 rounded-2xl border border-green-500/30 bg-green-500/5 text-center space-y-1">
        <div className="text-xs font-mono uppercase tracking-widest text-green-400/80">
          Target Showtime
        </div>
        <div className="text-2xl sm:text-4xl font-extrabold text-green-400 tracking-tight">
          {String(appState?.winning_date || "TBD")}
        </div>
      </div>

      {/* User Action Card */}
      <div className="bg-neutral-900/60 border border-neutral-800/90 p-6 sm:p-8 rounded-2xl text-center space-y-6">
        <h3 className="text-lg font-bold text-white">
          Can you make this showtime?
        </h3>

        {user?.is_available !== undefined && user?.is_available !== null ? (
          <div className="space-y-4">
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${
                user.is_available
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              {user.is_available ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> YOU&apos;RE IN
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" /> CAN&apos;T MAKE IT
                </>
              )}
            </div>
            <p className="text-xs text-neutral-400">
              Waiting for the rest of the kirigta to confirm before payment opens.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfirm(!user.is_available)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Switch to &ldquo;{user.is_available ? "Can't make it" : "I'm in"}
                &rdquo;
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={() => handleConfirm(true)}
              disabled={isSubmitting}
              className="h-12 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Yes, Count Me In
            </Button>
            <Button
              onClick={() => handleConfirm(false)}
              disabled={isSubmitting}
              variant="destructive"
              className="h-12 font-semibold text-sm"
            >
              <XCircle className="w-4 h-4 mr-2" />
              No, I Can&apos;t Make It
            </Button>
          </div>
        )}
      </div>

      {/* Live kirigta Roll Call */}
      <div className="bg-neutral-900/40 border border-neutral-800/80 p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-neutral-400">
          <span>kirigta Roll Call</span>
          <span className="text-green-400">{goingList.length} Confirmed In</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-green-400 font-semibold">
              <span>Going</span>
              <span>{goingList.length}</span>
            </div>
            <div className="space-y-1.5">
              {goingList.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-neutral-200">
                  {m.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.avatar_url}
                      alt={m.name}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-neutral-800 text-[10px] flex items-center justify-center">
                      {m.name.charAt(0)}
                    </div>
                  )}
                  <span className="truncate">{m.name}</span>
                </div>
              ))}
              {goingList.length === 0 && (
                <div className="text-neutral-600 italic">None yet</div>
              )}
            </div>
          </div>

          <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-amber-400 font-semibold">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Awaiting
              </span>
              <span>{pendingList.length}</span>
            </div>
            <div className="space-y-1.5">
              {pendingList.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-neutral-400">
                  {m.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.avatar_url}
                      alt={m.name}
                      className="w-5 h-5 rounded-full object-cover opacity-70"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-neutral-800 text-[10px] flex items-center justify-center">
                      {m.name.charAt(0)}
                    </div>
                  )}
                  <span className="truncate">{m.name}</span>
                </div>
              ))}
              {pendingList.length === 0 && (
                <div className="text-neutral-600 italic">Everyone replied</div>
              )}
            </div>
          </div>

          <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-red-400 font-semibold">
              <span>Out</span>
              <span>{outList.length}</span>
            </div>
            <div className="space-y-1.5">
              {outList.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-neutral-500">
                  {m.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.avatar_url}
                      alt={m.name}
                      className="w-5 h-5 rounded-full object-cover opacity-50"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-neutral-800 text-[10px] flex items-center justify-center">
                      {m.name.charAt(0)}
                    </div>
                  )}
                  <span className="truncate">{m.name}</span>
                </div>
              ))}
              {outList.length === 0 && (
                <div className="text-neutral-600 italic">None</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
