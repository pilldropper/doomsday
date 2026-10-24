"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RsvpOpen({ onComplete }: { onComplete: () => void }) {
  const { register, handleSubmit } = useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [votingOptions, setVotingOptions] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  useEffect(() => {
    async function fetchDates() {
      const { data } = await supabase.from('app_state').select('voting_dates').single();
      if (data && data.voting_dates) {
        setVotingOptions(data.voting_dates);
      } else {
        setVotingOptions(["2026-12-18", "2026-12-19", "2026-12-20", "Too early, let's settle this closer to December."]);
      }
    }
    fetchDates();
  }, []);

  const handleDateChange = (date: string) => {
    setSelectedDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const onSubmit = async (data: Record<string, unknown>) => {
    if (!avatarFile || !receiptFile) {
      toast.error("Please upload both an avatar and a receipt.");
      return;
    }
    if (selectedDates.length === 0) {
      toast.error("Please select at least one date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const avatarExt = avatarFile.name.split('.').pop();
      const avatarPath = `${Date.now()}-${Math.random().toString(36).substring(7)}.${avatarExt}`;
      const { error: avatarError } = await supabase.storage.from('avatars').upload(avatarPath, avatarFile);
      if (avatarError) throw avatarError;
      const avatarUrl = supabase.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl;

      const receiptExt = receiptFile.name.split('.').pop();
      const receiptPath = `${Date.now()}-${Math.random().toString(36).substring(7)}.${receiptExt}`;
      const { error: receiptError } = await supabase.storage.from('receipts').upload(receiptPath, receiptFile);
      if (receiptError) throw receiptError;
      const receiptUrl = supabase.storage.from('receipts').getPublicUrl(receiptPath).data.publicUrl;

      const { error } = await supabase.from('users').insert({
        name: data.name,
        avatar_url: avatarUrl,
        voted_dates: selectedDates,
        payment_receipt_url: receiptUrl,
        payment_status: 'pending'
      });
      if (error) throw error;

      toast.success("RSVP Submitted! Your funds are pending verification.");
      onComplete();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit RSVP");
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
            <li><strong className="text-white">Pick your dates.</strong> Vote for all the days you are free.</li>
            <li><strong className="text-white">Chip in your ticket.</strong> Scan the QR code and upload your transfer receipt below.</li>
            <li><strong className="text-white">Pick your seat later.</strong> Once the winning date is locked and the ticket block is purchased, everyone who funded a ticket gets early access to pick their exact chair on our custom theater map.</li>
          </ol>
        </section>

        <section className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl">
          <h2 className="text-2xl font-bold mb-6 text-green-400">Join the Squad</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">What should we call you on the seating chart?</Label>
              <Input id="name" {...register("name", { required: true })} className="bg-neutral-950 border-neutral-700" placeholder="e.g. Tony Stark" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar">Upload a photo of your face or favorite character. This will show up on your chair when you pick your seat!</Label>
              <Input id="avatar" type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0] || null)} className="bg-neutral-950 border-neutral-700 text-neutral-400 file:text-green-500" />
            </div>

            <div className="space-y-3">
              <Label>Vote for Dates</Label>
              <div className="grid gap-2">
                {votingOptions.map((date) => (
                  <label key={date} className="flex items-center space-x-3 bg-neutral-950 p-3 rounded-lg border border-neutral-800 hover:border-green-500/50 cursor-pointer transition-colors">
                    <input type="checkbox" className="form-checkbox text-green-500 bg-neutral-900 border-neutral-700 rounded focus:ring-green-500 focus:ring-offset-neutral-950 h-5 w-5" checked={selectedDates.includes(date)} onChange={() => handleDateChange(date)} />
                    <span className="text-neutral-200">{date}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-neutral-800">
              <Label>Payment</Label>
              <div className="flex gap-4">
                <div className="w-24 h-24 bg-neutral-800 border border-neutral-700 rounded flex items-center justify-center text-xs text-neutral-500">QR Maya</div>
                <div className="w-24 h-24 bg-neutral-800 border border-neutral-700 rounded flex items-center justify-center text-xs text-neutral-500">QR GoTyme</div>
                <div className="w-24 h-24 bg-neutral-800 border border-neutral-700 rounded flex items-center justify-center text-xs text-neutral-500">QR MariBank</div>
              </div>
              <div className="space-y-2 pt-2">
                <Label htmlFor="receipt">Attach payment screenshot below.</Label>
                <Input id="receipt" type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files?.[0] || null)} className="bg-neutral-950 border-neutral-700 text-neutral-400 file:text-green-500" />
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-6">
              {isSubmitting ? "Uploading..." : "Lock Me In"}
            </Button>
          </form>
        </section>

        <section className="bg-red-950/30 border border-red-900/50 p-6 rounded-xl text-red-200/80 text-sm leading-relaxed">
          <h3 className="text-red-400 font-bold text-lg mb-2 uppercase">The &quot;Zero Flake&quot; Guarantee &amp; Fund Pool</h3>
          <p className="mb-2">I will hold onto all transferred funds in a dedicated pool until we reach our minimum headcount of SURE attendees. If we don&apos;t get enough people, or if the group votes to postpone because it&apos;s too early, I will refund everyone and we scrap the plan.</p>
          <p><strong className="text-red-300">However, once I purchase the ticket block, tickets are strictly non-refundable.</strong> If you RSVP and pay, you are locked in. If you flake or no-show on game day, we will enjoy the extra elbow room, but you will not get your money back. Please only send funds if you are 100% showing up!</p>
        </section>
      </div>
    </div>
  );
}
