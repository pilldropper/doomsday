"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/UserContext";

export default function DateConfirmation({ appState }: { appState: Record<string, unknown> | null }) {
  const { user, setUser } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async (isAvailable: boolean) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_available: isAvailable })
        .eq('id', user.id);

      if (error) throw error;

      setUser({ ...user, is_available: isAvailable });
      toast.success("Confirmation saved!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save confirmation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 pt-24 text-center">
      <h2 className="text-3xl font-bold text-white mb-4 uppercase tracking-wider">Date Selection Finalist</h2>
      <p className="text-lg text-neutral-400 mb-8">
        The votes are in! The tentative winning date is:
      </p>

      <div className="text-4xl font-extrabold text-green-500 mb-12 p-8 border border-green-500/30 rounded-xl bg-green-500/10">
        {String(appState?.winning_date || 'TBD')}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-xl">
        <h3 className="text-xl font-bold text-white mb-6">Can you make it on this date?</h3>

        {user?.is_available !== undefined && user?.is_available !== null ? (
          <div className="space-y-4">
            <div className={`text-xl font-bold ${user.is_available ? 'text-green-400' : 'text-red-400'}`}>
              You responded: {user.is_available ? "YES, I'M IN!" : "NO, CAN'T MAKE IT."}
            </div>
            <div className="text-sm text-neutral-500">Wait for the admin to officially lock the date or request a revote.</div>
            <div className="pt-4 border-t border-neutral-800 flex justify-center gap-4">
               <Button variant="outline" size="sm" onClick={() => handleConfirm(!user.is_available)} disabled={isSubmitting}>
                 Change my response
               </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            <Button onClick={() => handleConfirm(true)} disabled={isSubmitting} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold h-16 text-lg">
              Yes, I&apos;m in!
            </Button>
            <Button onClick={() => handleConfirm(false)} disabled={isSubmitting} variant="destructive" className="flex-1 font-bold h-16 text-lg">
              No, I can&apos;t
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
