"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/UserContext";
import { MessageSquare, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  users?: { name: string; avatar_url: string };
};

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ChatBox() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const isOpenRef = useRef(isOpen);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setUnreadCount(0);
      scrollToBottom();
    }
  }, [isOpen]);

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel("public:chat_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          fetchMessages();
          if (!isOpenRef.current) {
            setUnreadCount((c) => c + 1);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*, users(name, avatar_url)")
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) setMessages(data as ChatMessage[]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const message = newMessage.trim();
    setNewMessage("");

    await supabase.from("chat_messages").insert({
      user_id: user.id,
      message,
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open Squad Comms"
        className={`fixed bottom-6 right-6 w-12 h-12 bg-green-600 hover:bg-green-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-green-950/50 transition-all ${
          isOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
        } z-40`}
      >
        <MessageSquare className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-neutral-950 text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 right-6 w-[calc(100vw-3rem)] sm:w-88 max-w-sm h-[460px] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col z-50 transition-all duration-200 origin-bottom-right ${
          isOpen
            ? "scale-100 opacity-100"
            : "scale-95 opacity-0 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950/90 rounded-t-2xl">
          <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-green-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Squad Comms
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-neutral-500 hover:text-white p-1 rounded-md hover:bg-neutral-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-xs text-neutral-600 text-center px-6">
              No messages yet. Say hello to the squad!
            </div>
          )}
          {messages.map((msg) => {
            const isMe = user?.id === msg.user_id;
            const senderName = msg.users?.name || "Squad Member";
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-[85%] ${
                  isMe ? "ml-auto flex-row-reverse" : ""
                }`}
              >
                {msg.users?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={msg.users.avatar_url}
                    alt={senderName}
                    className="w-7 h-7 rounded-full object-cover shrink-0 bg-neutral-800 mt-1"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 text-[10px] font-bold text-neutral-300 flex items-center justify-center shrink-0 mt-1">
                    {senderName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div
                  className={`flex flex-col ${
                    isMe ? "items-end" : "items-start"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-medium text-neutral-400">
                      {isMe ? "You" : senderName}
                    </span>
                    <span className="text-[10px] text-neutral-600">
                      {formatMessageTime(msg.created_at)}
                    </span>
                  </div>
                  <div
                    className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words ${
                      isMe
                        ? "bg-green-600 text-white rounded-tr-xs"
                        : "bg-neutral-800 text-neutral-200 rounded-tl-xs"
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {user ? (
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-neutral-800 bg-neutral-950/90 rounded-b-2xl flex gap-2"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message squad..."
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-full px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-green-500/60"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim()}
              className="rounded-full bg-green-600 hover:bg-green-500 text-white shrink-0 w-8 h-8"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        ) : (
          <div className="p-3 border-t border-neutral-800 bg-neutral-950/90 rounded-b-2xl text-center text-xs text-neutral-500">
            Log in to chat with the squad
          </div>
        )}
      </div>
    </>
  );
}
