"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUser } from "@/lib/UserContext";
import {
  CreditCard,
  Upload,
  CheckCircle2,
  Clock,
  ExternalLink,
  AlertTriangle,
  QrCode,
} from "lucide-react";

type FundingMember = {
  id: string;
  name: string;
  avatar_url: string;
  payment_status: string;
  is_available: boolean | null;
};

export default function PaymentPhase({
  appState,
}: {
  appState?: Record<string, unknown> | null;
}) {
  const { user, setUser } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [members, setMembers] = useState<FundingMember[]>([]);

  useEffect(() => {
    if (!receiptFile) {
      setReceiptPreview(null);
      return;
    }
    const url = URL.createObjectURL(receiptFile);
    setReceiptPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptFile]);

  useEffect(() => {
    async function fetchStats() {
      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url, payment_status, is_available")
        .order("created_at", { ascending: true });
      if (data) {
        setMembers(data as FundingMember[]);
      }
    }
    fetchStats();

    const channel = supabase
      .channel("public:users:payment")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onSubmit = async () => {
    if (!user) return;
    if (!receiptFile) {
      toast.error("Please attach your payment receipt screenshot.");
      return;
    }

    setIsSubmitting(true);
    try {
      const receiptExt = receiptFile.name.split(".").pop();
      const receiptPath = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${receiptExt}`;
      const { error: receiptError } = await supabase.storage
        .from("receipts")
        .upload(receiptPath, receiptFile);
      if (receiptError) throw receiptError;
      const receiptUrl = supabase.storage
        .from("receipts")
        .getPublicUrl(receiptPath).data.publicUrl;

      const { error } = await supabase
        .from("users")
        .update({
          payment_receipt_url: receiptUrl,
          payment_status: "pending",
        })
        .eq("id", user.id);

      if (error) throw error;

      setUser({
        ...user,
        payment_receipt_url: receiptUrl,
        payment_status: "pending",
      });
      setIsReplacing(false);
      setReceiptFile(null);
      toast.success("Receipt uploaded! Awaiting admin verification.");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload receipt"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Use available members if any confirmed, otherwise all members
  const activePool =
    members.some((m) => m.is_available === true)
      ? members.filter((m) => m.is_available === true)
      : members;

  const paidCount = activePool.filter(
    (u) => u.payment_status === "approved" || u.payment_status === "pending"
  ).length;
  const approvedCount = activePool.filter(
    (u) => u.payment_status === "approved"
  ).length;
  const totalCount = activePool.length;
  const progressPercentage =
    totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 space-y-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-green-400">
          <CreditCard className="w-3.5 h-3.5" /> Phase 3 {"//"} Ticket Pool
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Fund the Mission
          </h1>
          {Boolean(appState?.winning_date) && (
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/30 text-green-400">
              Showtime: {String(appState?.winning_date)}
            </span>
          )}
        </div>
        <p className="text-sm sm:text-base text-neutral-400">
          Send your ticket share to any account below and upload your
          receipt screenshot to unlock seat selection.
        </p>
      </header>

      {/* Live Progress Card */}
      <div className="bg-neutral-900/60 border border-neutral-800/90 p-5 sm:p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider">
          <span className="text-neutral-400">kirigta Funding Pool</span>
          <span className="text-green-400 font-bold">
            {paidCount} / {totalCount} Submitted ({approvedCount} Verified)
          </span>
        </div>
        <div className="h-3 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
          <div
            className="h-full bg-green-500 transition-all duration-700 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* kirigta Status Chips */}
        {activePool.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {activePool.map((m) => {
              const isApproved = m.payment_status === "approved";
              const isPending = m.payment_status === "pending";
              return (
                <div
                  key={m.id}
                  className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-xs border ${
                    isApproved
                      ? "bg-green-500/10 border-green-500/30 text-green-300"
                      : isPending
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-neutral-950 border-neutral-800 text-neutral-500"
                  }`}
                >
                  {m.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.avatar_url}
                      alt={m.name}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-neutral-800 text-[9px] flex items-center justify-center">
                      {m.name.charAt(0)}
                    </div>
                  )}
                  <span className="truncate max-w-[100px]">{m.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Channels & Upload */}
      <div className="bg-neutral-900/60 border border-neutral-800/90 p-5 sm:p-6 rounded-2xl space-y-6">
        <div className="space-y-3">
          <Label className="text-xs font-mono uppercase tracking-wider text-neutral-400">
            Transfer Channels
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {["Maya", "GoTyme", "MariBank"].map((channel) => (
              <div
                key={channel}
                className="p-4 bg-neutral-950/90 border border-neutral-800 rounded-xl flex flex-col items-center justify-center gap-2 text-center"
              >
                <QrCode className="w-7 h-7 text-neutral-500" />
                <span className="text-xs font-semibold text-neutral-300">
                  {channel}
                </span>
              </div>
            ))}
          </div>
        </div>

        {user?.payment_receipt_url && !isReplacing ? (
          <div
            className={`p-5 rounded-xl border space-y-3 ${
              user.payment_status === "approved"
                ? "bg-green-950/20 border-green-500/40"
                : "bg-amber-950/20 border-amber-500/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div
                className={`inline-flex items-center gap-2 text-sm font-bold ${
                  user.payment_status === "approved"
                    ? "text-green-400"
                    : "text-amber-400"
                }`}
              >
                {user.payment_status === "approved" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> PAYMENT VERIFIED
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" /> PENDING VERIFICATION
                  </>
                )}
              </div>
              <a
                href={user.payment_receipt_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-neutral-300 hover:text-white underline underline-offset-4"
              >
                View Receipt <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {user.payment_status === "approved"
                ? "Your ticket funds are verified. You're cleared for the live seat selection phase."
                : "Your receipt screenshot has been uploaded. Once verified by admin, your status will switch to Approved automatically."}
            </p>
            {user.payment_status !== "approved" && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setIsReplacing(true)}
                >
                  Replace Receipt Screenshot
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-4 border-t border-neutral-800/80">
            <div className="space-y-2">
              <Label
                htmlFor="receipt"
                className="text-xs font-mono uppercase tracking-wider text-neutral-400"
              >
                Upload Payment Receipt Screenshot
              </Label>
              <label
                htmlFor="receipt"
                className="flex items-center gap-4 p-4 rounded-xl bg-neutral-950 border border-dashed border-neutral-800 hover:border-green-500/50 cursor-pointer transition-colors"
              >
                {receiptPreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="w-14 h-14 rounded-lg object-cover border border-green-500/40 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-neutral-200 truncate">
                    {receiptFile
                      ? receiptFile.name
                      : "Click to attach receipt image"}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Screenshot of your transfer confirmation
                  </div>
                </div>
                <input
                  id="receipt"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="flex gap-2">
              {isReplacing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsReplacing(false);
                    setReceiptFile(null);
                  }}
                  className="h-11"
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={onSubmit}
                disabled={isSubmitting || !receiptFile}
                className="flex-1 h-11 bg-green-600 hover:bg-green-500 text-white font-semibold"
              >
                {isSubmitting ? "Uploading Receipt..." : "Submit Receipt"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Zero Flake Policy */}
      <section className="bg-red-950/20 border border-red-900/40 p-5 rounded-2xl text-red-200/80 text-xs leading-relaxed space-y-2">
        <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4" /> Ibabalik ko as long as waray pa pumalit hin ticket
        </div>
        <p>
          The funds will be held until ready na pumalit hin tickets.
        </p>
        <p className="text-red-300 font-medium">
          Remember: Once pumalit na online, tickets are strictly
          non-refundable.
        </p>
      </section>
    </div>
  );
}
