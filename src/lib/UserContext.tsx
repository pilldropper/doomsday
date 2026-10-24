"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabase";

export type User = {
  id: string;
  name: string;
  avatar_url: string;
  voted_dates: string[];
  payment_receipt_url: string;
  payment_status: string;
  password?: string;
  is_available?: boolean | null;
};

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem("doomsday_user_id");
    if (storedUserId) {
      supabase
        .from("users")
        .select("*")
        .eq("id", storedUserId)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserState(data as User);
          } else {
            localStorage.removeItem("doomsday_user_id");
          }
        });
    }
  }, []);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem("doomsday_user_id", newUser.id);
    } else {
      localStorage.removeItem("doomsday_user_id");
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
