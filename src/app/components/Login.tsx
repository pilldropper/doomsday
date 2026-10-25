"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/lib/UserContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Upload, Film } from "lucide-react";

async function hashPassword(password: string) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function Login() {
  const { setUser } = useUser();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit } = useForm();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const onSubmit = async (data: Record<string, unknown>) => {
    const cleanName = String(data.name || "").trim();
    const rawPassword = String(data.password || "");

    if (!cleanName || !rawPassword) {
      toast.error("Please enter both your name and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLogin) {
        const { data: user, error } = await supabase
          .from("users")
          .select("*")
          .ilike("name", cleanName)
          .maybeSingle();

        if (error || !user) {
          toast.error("User not found. Need to register first?");
        } else if (user.password !== (await hashPassword(rawPassword))) {
          toast.error("Incorrect password.");
        } else {
          setUser(user);
          toast.success(`Welcome back, ${user.name}!`);
        }
      } else {
        if (!avatarFile) {
          toast.error("Please upload an avatar image.");
          return;
        }

        // Check if name is already taken
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .ilike("name", cleanName)
          .maybeSingle();

        if (existingUser) {
          toast.error("That name is already registered. Try logging in instead.");
          return;
        }

        const avatarExt = avatarFile.name.split(".").pop();
        const avatarPath = `${Date.now()}-${Math.random().toString(36).substring(7)}.${avatarExt}`;
        const { error: avatarError } = await supabase.storage
          .from("avatars")
          .upload(avatarPath, avatarFile);
        if (avatarError) throw avatarError;
        const avatarUrl = supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl;

        const { data: newUser, error } = await supabase
          .from("users")
          .insert({
            name: cleanName,
            password: await hashPassword(rawPassword),
            avatar_url: avatarUrl,
            payment_status: "unpaid",
            payment_receipt_url: "",
          })
          .select()
          .single();

        if (error) throw error;

        setUser(newUser);
        toast.success("Registered! Welcome to the kirigta.");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Minimal Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/25 text-green-400 text-xs font-mono uppercase tracking-widest mb-2">
            <Film className="w-3.5 h-3.5" /> December 2026
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white uppercase">
            Avengers: Doomsday
          </h1>
          <p className="text-sm text-neutral-400">
            kirigta block ticketing &amp; seat coordination
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-neutral-900/70 border border-neutral-800/90 p-6 rounded-2xl shadow-2xl space-y-6">
          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-neutral-950 rounded-lg border border-neutral-800/80 text-xs font-medium">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`py-2 rounded-md transition-all ${
                isLogin
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              kirigta Login
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`py-2 rounded-md transition-all ${
                !isLogin
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Join the kirigta
            </button>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit, () =>
              toast.error("Please enter both your name and password.")
            )}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs text-neutral-400">
                Name
              </Label>
              <Input
                id="name"
                {...register("name", { required: true })}
                className="h-10 bg-neutral-950 border-neutral-800 focus-visible:border-green-500/60"
                placeholder="e.g. Josh"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-neutral-400">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password", { required: true })}
                  className="h-10 bg-neutral-950 border-neutral-800 pr-10 focus-visible:border-green-500/60"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="avatar" className="text-xs text-neutral-400">
                  Seat Avatar (shown on the theater map)
                </Label>
                <label
                  htmlFor="avatar"
                  className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950 border border-dashed border-neutral-800 hover:border-green-500/50 cursor-pointer transition-colors"
                >
                  {avatarPreview ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={avatarPreview}
                      alt="Preview"
                      className="w-11 h-11 rounded-full object-cover border border-green-500/40 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-neutral-200 truncate">
                      {avatarFile ? avatarFile.name : "Upload profile photo"}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      PNG, JPG or WEBP
                    </div>
                  </div>
                  <input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                </label>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-green-600 hover:bg-green-500 text-white font-semibold mt-2"
            >
              {isSubmitting
                ? "Authenticating..."
                : isLogin
                ? "Login"
                : "Create kirigta Profile"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
