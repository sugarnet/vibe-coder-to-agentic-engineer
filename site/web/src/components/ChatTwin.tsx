"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Send, 
  Cpu, 
  Sparkles, 
  Zap, 
  Terminal
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatTwin() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello. I am Diego's Digital Twin. My neural pathways are primed with his career data. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      const data = await response.json();
      if (data.choices && data.choices[0]) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.choices[0].message.content },
        ]);
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Signal interference detected. Unable to reach the neural core. Please retry." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end font-sans">
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, scale: 0.9, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, y: 20, filter: "blur(10px)" }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="glass-hologram noise-texture relative mb-6 flex h-[600px] w-[380px] flex-col overflow-hidden rounded-[2.5rem] md:w-[440px]"
          >
            {/* Scanning Line Effect */}
            <div className="animate-scan absolute left-0 top-0 h-[2px] w-full bg-edge/30 blur-sm pointer-events-none" />
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-5 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="relative h-10 w-10">
                  <div className="animate-neural-pulse absolute inset-0 rounded-full bg-edge/30 blur-md" />
                  <div className="relative flex h-full w-full items-center justify-center rounded-full border border-edge/50 bg-obsidian/80">
                    <Cpu className="h-5 w-5 text-edge" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                    NEURAL TWIN <span className="text-[10px] bg-edge/20 text-edge px-1.5 py-0.5 rounded border border-edge/30 uppercase">v2.6</span>
                  </h3>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <div className="h-1.5 w-1.5 rounded-full bg-edge animate-pulse" />
                    <span className="text-[10px] uppercase tracking-wider text-white/50">Core Sync: Active</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="group relative flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
                <div className="absolute inset-0 rounded-full border border-white/0 group-hover:border-white/20 transition-all scale-125 opacity-0 group-hover:opacity-100 group-hover:scale-100" />
              </button>
            </div>

            {/* Messages body */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none relative"
            >
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: msg.role === "user" ? 20 : -20, y: 10 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"} max-w-[85%]`}>
                    <div className="flex items-center gap-2 px-1 mb-1">
                       {msg.role === "assistant" ? <Sparkles className="h-3 w-3 text-edge/60" /> : <Terminal className="h-3 w-3 text-ember/60" />}
                       <span className="text-[9px] uppercase tracking-widest text-white/30 font-bold">{msg.role === "assistant" ? "Neural Core" : "Query Source"}</span>
                    </div>
                    <div
                      className={`relative rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-ember/10 text-ember border border-ember/20 rounded-tr-none"
                          : "bg-edge/5 text-white/90 border border-edge/20 rounded-tl-none"
                      }`}
                    >
                      {msg.role === "assistant" && i === messages.length - 1 && isLoading === false ? (
                        <Typewriter text={msg.content} delay={15} />
                      ) : (
                        msg.content
                      )}
                      
                      {/* Subtlest glow for neon effect */}
                      <div className={`absolute inset-0 rounded-2xl blur-xl opacity-20 pointer-events-none ${msg.role === "user" ? "bg-ember" : "bg-edge"}`} />
                    </div>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                   <div className="flex flex-col gap-1 items-start max-w-[85%]">
                     <div className="flex items-center gap-2 px-1 mb-1">
                        <Zap className="h-3 w-3 text-edge animate-pulse" />
                        <span className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Materializing Response</span>
                     </div>
                     <div className="rounded-2xl rounded-tl-none bg-edge/5 border border-edge/20 px-5 py-3 text-sm text-edge/60">
                        <div className="flex gap-1.5 h-4 items-center">
                          <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="h-1 w-1 bg-edge rounded-full" />
                          <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="h-1 w-1 bg-edge rounded-full" />
                          <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="h-1 w-1 bg-edge rounded-full" />
                        </div>
                     </div>
                   </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="bg-white/5 p-6 backdrop-blur-xl border-t border-white/10">
              <div className="relative group">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Intercept data core..."
                  className="w-full rounded-full border border-white/10 bg-white/5 pl-6 pr-14 py-4 text-sm text-white placeholder-white/20 focus:border-edge/50 focus:outline-none focus:ring-1 focus:ring-edge/30 transition-all outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading}
                  className="absolute right-2 top-2 h-10 w-10 flex items-center justify-center rounded-full bg-edge text-obsidian transition-all hover:scale-105 active:scale-95 disabled:opacity-50 group-hover:shadow-[0_0_15px_rgba(106,240,255,0.4)]"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex justify-between items-center px-2">
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/20 font-bold">Secure Protocol Activated</p>
                <div className="flex gap-2">
                  <div className="h-1 w-1 rounded-full bg-white/10" />
                  <div className="h-1 w-1 rounded-full bg-white/10" />
                  <div className="h-1 w-1 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="orb-button"
            layoutId="orb"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 45 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="group relative h-20 w-20 flex items-center justify-center"
          >
            {/* Ambient Aura */}
            <div className="animate-neural-pulse absolute inset-0 rounded-full bg-edge/20 blur-2xl group-hover:bg-edge/40 transition-all duration-500" />
            
            {/* The Core Orb */}
            <div className="relative h-16 w-16 flex items-center justify-center rounded-full border border-edge/30 bg-obsidian/40 backdrop-blur-xl overflow-hidden glass-hologram">
              <div className="animate-scan absolute inset-0 bg-edge/10 h-[2px] w-full blur-[1px]" />
              <div className="animate-float flex items-center justify-center">
                <Cpu className="h-8 w-8 text-edge group-hover:scale-110 transition-transform" />
              </div>
              
              {/* Particle like noise */}
              <div className="absolute inset-0 noise-texture opacity-20 pointer-events-none" />
            </div>
            
            {/* Label tip */}
            <div className="absolute -top-10 right-0 px-3 py-1 bg-edge/10 border border-edge/20 rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="text-[10px] text-edge font-bold tracking-[0.3em] uppercase">Connect Sync</span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function Typewriter({ text, delay = 20 }: { text: string; delay?: number }) {
  const [currentText, setCurrentText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setCurrentText((prevText) => prevText + text[currentIndex]);
        setCurrentIndex((prevIndex) => prevIndex + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, delay, text]);

  return (
    <span>
      {currentText}
      {currentIndex < text.length && (
        <motion.span
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="inline-block ml-0.5 h-3 w-1 bg-edge align-middle"
        />
      )}
    </span>
  );
}
