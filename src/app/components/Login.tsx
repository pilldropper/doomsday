"use client";
import { useState } from "react";
import { useUser } from "@/lib/UserContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";


async function hashPassword(password: string) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function Login() {
  const { setUser } = useUser();
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit } = useForm();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const onSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      if (isLogin) {
        const { data: user, error } = await supabase
          .from("users")
          .select("*")
          .eq("name", data.name)
          .single();

        if (error || !user) {
          toast.error("User not found.");
        } else if (user.password !== await hashPassword(data.password as string)) {
          toast.error("Incorrect password.");
        } else {
          setUser(user);
          toast.success("Logged in successfully!");
        }
      } else {
        if (!avatarFile) {
          toast.error("Please upload an avatar.");
          return;
        }

        const avatarExt = avatarFile.name.split(".").pop();
        const avatarPath = `${Date.now()}-${Math.random().toString(36).substring(7)}.${avatarExt}`;
        const { error: avatarError } = await supabase.storage.from("avatars").upload(avatarPath, avatarFile);
        if (avatarError) throw avatarError;
        const avatarUrl = supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl;

        const { data: newUser, error } = await supabase
          .from("users")
          .insert({
            name: data.name,
            password: await hashPassword(data.password as string),
            avatar_url: avatarUrl,
            payment_status: "unpaid",
            payment_receipt_url: ""
          })
          .select()
          .single();

        if (error) throw error;

        setUser(newUser);
        toast.success("Registered successfully!");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 pt-12">
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl space-y-6">
        <h2 className="text-2xl font-bold text-green-400 text-center">
          {isLogin ? "Squad Login" : "Join the Squad"}
        </h2>

        <form
          onSubmit={handleSubmit(onSubmit, () => toast.error("Please enter both your name and password."))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name", { required: true })} className="bg-neutral-950 border-neutral-700" placeholder="e.g. Tony Stark" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register("password", { required: true })} className="bg-neutral-950 border-neutral-700" />
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar Image</Label>
              <Input id="avatar" type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0] || null)} className="bg-neutral-950 border-neutral-700 text-neutral-400 file:text-green-500" />
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6">
            {isSubmitting ? "Processing..." : (isLogin ? "Login" : "Register")}
          </Button>
        </form>

        <div className="text-center text-sm text-neutral-400">
          {isLogin ? "Don't have an account? " : "Already registered? "}
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-green-500 hover:underline">
            {isLogin ? "Register here" : "Login here"}
          </button>
        </div>
      </div>
    </div>
  );
}
