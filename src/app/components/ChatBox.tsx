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

export default function ChatBox() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel('public:chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        fetchMessages();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
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

    const message = newMessage;
    setNewMessage("");

    await supabase.from("chat_messages").insert({
      user_id: user.id,
      message: message
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center text-white shadow-xl shadow-green-900/20 transition-transform ${isOpen ? 'scale-0' : 'scale-100'} z-40`}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      <div className={`fixed bottom-6 right-6 w-80 sm:w-96 h-[500px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl flex flex-col z-50 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950 rounded-t-xl">
          <h3 className="font-bold text-green-500 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Squad Comms
          </h3>
          <button onClick={() => setIsOpen(false)} className="text-neutral-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isMe = user?.id === msg.user_id;
            return (
              <div key={msg.id} className={`flex gap-3 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={msg.users?.avatar_url || '/placeholder.png'} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 bg-neutral-800" />
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-neutral-500 mb-1">{msg.users?.name}</span>
                  <div className={`p-3 rounded-2xl text-sm ${isMe ? 'bg-green-600 text-white rounded-tr-none' : 'bg-neutral-800 text-neutral-200 rounded-tl-none'}`}>
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
          <form onSubmit={handleSend} className="p-4 border-t border-neutral-800 bg-neutral-950 rounded-b-xl flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message squad..."
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-green-500"
            />
            <Button type="submit" size="icon" className="rounded-full bg-green-600 hover:bg-green-700 shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        ) : (
          <div className="p-4 border-t border-neutral-800 bg-neutral-950 rounded-b-xl text-center text-sm text-neutral-500">
            Log in to chat
          </div>
        )}
      </div>
    </>
  );
}
