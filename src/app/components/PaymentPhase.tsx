"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/lib/UserContext";

export default function PaymentPhase() {
  const { user, setUser } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paymentStats, setPaymentStats] = useState({ paid: 0, total: 0 });

  useEffect(() => {
    async function fetchStats() {
      // Find all users who are marked as available
      const { data } = await supabase.from('users').select('payment_status').eq('is_available', true);
      if (data) {
        const total = data.length;
        const paid = data.filter(u => u.payment_status === 'approved' || u.payment_status === 'pending').length;
        setPaymentStats({ paid, total });
      }
    }
    fetchStats();

    // Listen for changes to users table for live progress bar
    const channel = supabase.channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchStats();
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const onSubmit = async () => {
    if (!user) return;
    if (!receiptFile) {
      toast.error("Please attach your payment receipt screenshot.");
      return;
    }

    setIsSubmitting(true);
    try {
      const receiptExt = receiptFile.name.split('.').pop();
      const receiptPath = `${Date.now()}-${Math.random().toString(36).substring(7)}.${receiptExt}`;
      const { error: receiptError } = await supabase.storage.from('receipts').upload(receiptPath, receiptFile);
      if (receiptError) throw receiptError;
      const receiptUrl = supabase.storage.from('receipts').getPublicUrl(receiptPath).data.publicUrl;

      const { error } = await supabase.from('users').update({
        payment_receipt_url: receiptUrl,
        payment_status: "pending"
      }).eq('id', user.id);

      if (error) throw error;

      setUser({ ...user, payment_receipt_url: receiptUrl, payment_status: 'pending' });
      toast.success("Receipt uploaded! Awaiting admin verification.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to upload receipt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercentage = paymentStats.total > 0 ? (paymentStats.paid / paymentStats.total) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto p-6 pt-12">
      <header className="mb-8 text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-green-500 uppercase tracking-tighter">Fund the Mission</h1>
        <p className="text-lg text-neutral-300">
          The date is locked. It&apos;s time to secure the tickets. Send your funds to any of the accounts below and upload the receipt.
        </p>
      </header>

      {/* Progress Bar */}
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl mb-12">
        <div className="flex justify-between text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wide">
          <span>Squad Funding Progress</span>
          <span className="text-green-500">{paymentStats.paid} / {paymentStats.total} Paid</span>
        </div>
        <div className="h-4 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
          <div
            className="h-full bg-green-500 transition-all duration-1000 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <p className="text-xs text-neutral-500 mt-2 text-center">
          Tickets will be purchased once everyone has chipped in!
        </p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl space-y-8">
        <div className="space-y-4">
          <Label className="text-xl font-bold text-white">Payment Methods</Label>
          <div className="flex flex-wrap gap-4">
            <div className="w-32 h-32 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center text-sm font-bold text-neutral-400">QR Maya</div>
            <div className="w-32 h-32 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center text-sm font-bold text-neutral-400">QR GoTyme</div>
            <div className="w-32 h-32 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center text-sm font-bold text-neutral-400">QR MariBank</div>
          </div>
        </div>

        {user?.payment_receipt_url ? (
          <div className={`p-6 rounded-xl border ${user.payment_status === 'approved' ? 'bg-green-950/20 border-green-500/50' : 'bg-amber-950/20 border-amber-500/50'}`}>
            <h3 className={`text-xl font-bold mb-2 ${user.payment_status === 'approved' ? 'text-green-400' : 'text-amber-400'}`}>
              Status: {user.payment_status.toUpperCase()}
            </h3>
            <p className="text-neutral-300">
              {user.payment_status === 'approved'
                ? "Your payment is verified! You are officially locked in for the seat scramble."
                : "Your receipt has been submitted and is pending verification by the admin."}
            </p>
            <div className="mt-4 pt-4 border-t border-neutral-800/50">
               <a href={user.payment_receipt_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm">View Submitted Receipt</a>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-6 border-t border-neutral-800">
            <div className="space-y-2">
              <Label htmlFor="receipt" className="text-lg">Attach Payment Screenshot</Label>
              <Input id="receipt" type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files?.[0] || null)} className="bg-neutral-950 border-neutral-700 text-neutral-400 file:text-green-500 p-2 h-auto" />
            </div>
            <Button onClick={onSubmit} disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-6 mt-4">
              {isSubmitting ? "Uploading..." : "Submit Receipt"}
            </Button>
          </div>
        )}
      </div>

      <section className="bg-red-950/30 border border-red-900/50 p-6 rounded-xl text-red-200/80 text-sm leading-relaxed mt-12">
        <h3 className="text-red-400 font-bold text-lg mb-2 uppercase">The &quot;Zero Flake&quot; Guarantee</h3>
        <p className="mb-2">I will hold onto all transferred funds in a dedicated pool until we reach our headcount. If someone backs out and we don&apos;t have enough to book the block, I will refund everyone and we scrap the plan.</p>
        <p><strong className="text-red-300">However, once I purchase the ticket block, tickets are strictly non-refundable.</strong> If you RSVP and pay, you are locked in. If you flake or no-show on game day, we will enjoy the extra elbow room, but you will not get your money back. Please only send funds if you are 100% showing up!</p>
      </section>
    </div>
  );
}
