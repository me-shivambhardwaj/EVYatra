"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User, Sparkles, ChevronDown, RefreshCw } from "lucide-react";
import { EVS } from "@/lib/data/evs";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  sources?: string[];
  timestamp: string;
}

// Curated list of cars for the chip dropdown
const CAR_OPTIONS = [
  "Hyundai Ioniq 5",
  "Tata Nexon EV",
  "Tata Punch EV",
  ...Array.from(new Set(EVS.map((e) => `${e.brand} ${e.name}`)))
    .filter((name) => !["Hyundai Ioniq 5", "Tata Nexon EV", "Tata Punch EV"].includes(name)),
];

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState("Hyundai Ioniq 5");
  const [carDropdownOpen, setCarDropdownOpen] = useState(false);
  const [userName, setUserName] = useState("there");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dynamic suggestion chips based on selected car
  const suggestionChips = [
    `${selectedCar} price`,
    `${selectedCar} range`,
    `${selectedCar} charging time`,
  ];

  // Fetch first name from /api/auth/me (else fallback to "there")
  useEffect(() => {
    let isMounted = true;
    const fetchUserName = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("evyatra:jwt") : null;
        if (token) {
          const res = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user?.name) {
              const firstName = data.user.name.trim().split(/\s+/)[0];
              if (firstName && isMounted) {
                setUserName(firstName);
                return;
              }
            }
          }
        }

        // Fallback to cached user object if token check fails or offline
        const storedUser = typeof window !== "undefined" ? localStorage.getItem("evyatra:user") : null;
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed?.name) {
            const firstName = parsed.name.trim().split(/\s+/)[0];
            if (firstName && isMounted) {
              setUserName(firstName);
              return;
            }
          }
        }
      } catch {
        // Fallback stays as "there"
      }
    };

    fetchUserName();
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize or update welcome greeting with the resolved user name
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0 || (prev.length === 1 && prev[0].id === "welcome")) {
        return [
          {
            id: "welcome",
            sender: "bot",
            text: `Hi ${userName}! I'm EVYatra Assistant.`,
            timestamp: "Just now",
          },
        ];
      }
      return prev;
    });
  }, [userName]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  // Mock answer fallback strictly for network failure when backend is unreachable
  const getMockReply = (question: string, car: string): { answer: string; sources: string[] } => {
    const q = question.toLowerCase();
    const matchedEV = EVS.find(
      (e) => `${e.brand} ${e.name}`.toLowerCase() === car.toLowerCase() ||
             q.includes(e.name.toLowerCase()) ||
             q.includes(`${e.brand} ${e.name}`.toLowerCase())
    ) || EVS[0];

    const carName = `${matchedEV.brand} ${matchedEV.name}`;

    if (q.includes("price") || q.includes("cost") || q.includes("rate")) {
      return {
        answer: `The ${carName} is priced at approximately ₹${matchedEV.priceLakh} Lakh (ex-showroom India).\n\nTip: On-road prices vary by state depending on road tax exemptions and local EV subsidies.`,
        sources: [`${matchedEV.brand.toLowerCase()}-${matchedEV.name.toLowerCase().replace(/\s+/g, '-')}.md`],
      };
    }

    if (q.includes("connector") || q.includes("plug") || q.includes("type 2") || q.includes("ccs")) {
      return {
        answer: `The ${carName} supports ${matchedEV.connectors.join(" and ")} connectors for charging.\n\nTip: Modern Indian highway chargers widely support CCS2 guns for rapid DC charging.`,
        sources: ["charger-types.md"],
      };
    }

    if (q.includes("charge") || q.includes("fast") || q.includes("time") || q.includes("dc")) {
      const chargeText = matchedEV.fastChargeMin > 0
        ? `reaches 10% to 80% charge in approximately ${matchedEV.fastChargeMin} minutes on a compatible DC rapid charger (max ${matchedEV.maxDcKw} kW)`
        : `takes approximately 4 to 6 hours on a standard AC home charger`;
      return {
        answer: `The ${carName} ${chargeText}.\n\nTip: Charging speed tapers off significantly above 80% to protect battery health.`,
        sources: [`${matchedEV.brand.toLowerCase()}-${matchedEV.name.toLowerCase().replace(/\s+/g, '-')}.md`],
      };
    }

    if (q.includes("range") || q.includes("km") || q.includes("distance") || q.includes("battery")) {
      return {
        answer: `The ${carName} features a ${matchedEV.batteryKwh} kWh battery pack with an official claimed range of ${matchedEV.rangeKm} km.\n\nTip: Setting regenerative braking to medium in city traffic can recover up to 15% of energy.`,
        sources: [`${matchedEV.brand.toLowerCase()}-${matchedEV.name.toLowerCase().replace(/\s+/g, '-')}.md`],
      };
    }

    return {
      answer: `I don't have that info in offline mode. Please verify that the EVYatra AI service is running or check our verified vehicle guides.\n\nTip: You can select other EV models from the dropdown at the top to explore their specs.`,
      sources: ["charger-types.md"],
    };
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const aiUrl = process.env.NEXT_PUBLIC_AI_URL || "http://localhost:8001";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const res = await fetch(`${aiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          car: selectedCar,
          user_name: userName,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: data.answer || "I don't have that info.",
        sources: Array.isArray(data.sources) && data.sources.length ? data.sources : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      // Mock fallback only on network failure
      const fallback = getMockReply(trimmed, selectedCar);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: fallback.answer,
        sources: fallback.sources,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="EVYatra AI Assistant"
          className="mb-4 flex h-[540px] w-[370px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 transition-all sm:w-[400px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-gradient-to-r from-emerald-700 to-brand px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shadow-inner">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold tracking-tight flex items-center gap-1.5">
                  EVYatra Assistant <Sparkles size={13} className="text-emerald-300" />
                </h3>
                <p className="text-[11px] text-emerald-100/90 font-medium">India EV & Charging Guide</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Close Chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Car Chip Bar */}
          <div className="relative border-b border-line bg-mist/60 px-4 py-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted">Asking for:</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCarDropdownOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-bold text-brand shadow-sm ring-1 ring-line hover:bg-brand-soft/50 transition-all text-xs"
                >
                  <span className="max-w-[160px] truncate">{selectedCar}</span>
                  <ChevronDown size={13} className="text-muted" />
                </button>

                {carDropdownOpen && (
                  <div className="absolute right-0 top-8 z-30 max-h-56 w-60 overflow-y-auto rounded-2xl bg-white py-1.5 shadow-xl ring-1 ring-black/10">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                      Select Your EV
                    </div>
                    {CAR_OPTIONS.map((car) => (
                      <button
                        key={car}
                        onClick={() => {
                          setSelectedCar(car);
                          setCarDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs font-semibold transition-colors hover:bg-brand-soft/60 ${
                          selectedCar === car ? "bg-brand/10 font-bold text-brand" : "text-ink"
                        }`}
                      >
                        {car}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 space-y-3.5 overflow-y-auto p-4 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.sender === "bot" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Bot size={15} />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                    m.sender === "user"
                      ? "bg-brand text-white font-medium rounded-br-xs shadow-sm"
                      : "bg-mist text-ink ring-1 ring-line rounded-bl-xs shadow-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>

                  {/* Sources tag list */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-line/60 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] font-semibold text-muted">Sources:</span>
                      {m.sources.map((src) => (
                        <span
                          key={src}
                          className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-bold text-brand ring-1 ring-brand/20"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  )}

                  <span
                    className={`mt-1 block text-[9px] font-medium ${
                      m.sender === "user" ? "text-emerald-100 text-right" : "text-slate-400"
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>

                {m.sender === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
                    <User size={15} />
                  </div>
                )}
              </div>
            ))}

            {/* Dynamic Suggestion Chips based on selected car */}
            {messages.length <= 1 && (
              <div className="pt-1">
                <p className="text-[11px] font-semibold text-muted mb-2 px-1">Suggested questions:</p>
                <div className="flex flex-col gap-1.5">
                  {suggestionChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      disabled={loading}
                      onClick={() => sendMessage(chip)}
                      className="w-full text-left rounded-xl bg-mist/80 hover:bg-brand/10 hover:text-brand border border-line px-3 py-2 text-xs font-semibold text-ink transition-colors shadow-2xs flex items-center justify-between group"
                    >
                      <span>{chip}</span>
                      <Sparkles size={12} className="text-muted group-hover:text-brand transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-muted">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand animate-pulse">
                  <Bot size={15} />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl bg-mist px-3 py-2 text-xs ring-1 ring-line">
                  <RefreshCw size={13} className="animate-spin text-brand" />
                  <span>Searching EV knowledge base...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={handleSend}
            className="border-t border-line bg-white p-3 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${selectedCar} or charging...`}
              disabled={loading}
              className="flex-1 rounded-2xl bg-mist px-4 py-2.5 text-xs font-semibold outline-none ring-1 ring-line focus:ring-2 focus:ring-brand placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-sm transition-all hover:bg-brand-dark disabled:opacity-40 disabled:hover:bg-brand"
              aria-label="Send Message"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button (Bottom-Right, Green) */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-xl shadow-brand/35 transition-all duration-300 hover:scale-105 hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/30"
        aria-label={isOpen ? "Close AI Assistant" : "Open EVYatra AI Assistant"}
      >
        {isOpen ? (
          <X size={24} className="transition-transform duration-200" />
        ) : (
          <MessageSquare size={24} className="transition-transform duration-200 group-hover:scale-110" />
        )}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-400" />
          </span>
        )}
      </button>
    </div>
  );
}
