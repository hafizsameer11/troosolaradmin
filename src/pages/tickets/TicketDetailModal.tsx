import { useEffect, useMemo, useRef, useState } from "react";
import images from "../../constants/images";
import type { ShopOrderData } from "./shpmgt";

// Integration
import { useQuery, useMutation } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { getSingleTicketDetail } from "../../utils/queries/tickets";
import { replyToTicket } from "../../utils/mutations/tickets";
import { updateTicketStatus } from "../../utils/mutations/tickets";


interface TicketDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: ShopOrderData | null;
    onStatusUpdate?: () => void; // Callback to refresh parent data
}

type ChatMsg = {
    id: string | number;
    role: "user" | "admin";
    text: string;
    at: string; // formatted time
};

const formatWhen = (value?: string) => {
    if (!value) return "—";
    const d = new Date(value.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return value;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const time = d.toLocaleString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
    return `${dd}-${mm}-${yyyy} / ${time}`;
};

const formatStatus = (value?: string) => {
    if (!value) return "Pending";
    return value.charAt(0).toUpperCase() + value.slice(1);
};

const TicketDetailModal = ({ isOpen, onClose, ticket, onStatusUpdate }: TicketDetailModalProps) => {
    const [status, setStatus] = useState<"Change Status" | "Pending" | "Answered" | "Closed">("Change Status");
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const listRef = useRef<HTMLDivElement>(null);

    const token = Cookies.get("token");
    const ticketId = ticket?.id;

    // Fetch ticket details from API
    const {
        data: ticketDetail,
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: ["single-ticket-detail", ticketId],
        queryFn: () => getSingleTicketDetail(ticketId || "", token || ""),
        enabled: isOpen && !!ticketId && !!token,
    });

    // Map API messages to ChatMsg[]
    useEffect(() => {
        if (!ticketDetail?.data) return;
        const apiMsgs: ChatMsg[] = ticketDetail.data.messages.map((m: { sender: string; message: string; date: string }, idx: number) => ({
            id: idx,
            role: m.sender === "admin" ? "admin" : "user",
            text: m.message,
            at: m.date
                ? m.date.replace(" ", " / ")
                : "",
        }));
        setMessages(apiMsgs);
        setStatus(
            ticketDetail.data.status.charAt(0).toUpperCase() +
            ticketDetail.data.status.slice(1)
        );
    }, [ticketDetail?.data]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages.length]);

    // Close on ESC
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, onClose]);

    const ticketMeta = useMemo(
        () => ({
            id: ticketDetail?.data?.ticket_id ?? ticket?.id ?? "—",
            subject: ticketDetail?.data?.subject ?? ticket?.productName ?? "—",
            userName: ticketDetail?.data?.user_name ?? ticket?.name ?? "Unknown",
            status: formatStatus(ticketDetail?.data?.status ?? ticket?.status),
            opened: formatWhen(ticketDetail?.data?.date ?? ticket?.date),
        }),
        [ticketDetail?.data, ticket]
    );

    // Send message mutation
    const sendMutation = useMutation({
        mutationFn: async (msg: string) => {
            return await replyToTicket(ticketMeta.id, { message: msg }, token || "");
        },
        onSuccess: () => {
            // Refetch ticket detail to get updated messages
            refetch();
            setInput("");
        },
        onError: () => {
            alert("Failed to send message.");
        },
    });

    // Update ticket status mutation
    const statusMutation = useMutation({
        mutationFn: async (newStatus: string) => {
            return await updateTicketStatus(ticketMeta.id, { status: newStatus.toLowerCase() }, token || "");
        },
        onSuccess: () => {
            // Refetch ticket detail to get updated status
            refetch();
            // Call parent callback to refresh tickets list
            onStatusUpdate?.();
            console.log("Ticket status updated successfully");
        },
        onError: (error) => {
            console.error("Failed to update ticket status:", error);
            alert("Failed to update ticket status.");
        },
    });

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed || !ticketMeta.id) return;
        sendMutation.mutate(trimmed);
    };

    const handleStatusChange = (newStatus: string) => {
        if (newStatus === "Change Status" || !ticketMeta.id) return;
        
        console.log("Updating ticket status to:", newStatus);
        statusMutation.mutate(newStatus);
    };

    const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen || !ticket) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-stretch sm:items-center sm:justify-end bg-black/30"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-[#F7F7F8] sm:rounded-2xl w-full sm:max-w-[480px] shadow-xl relative overflow-hidden h-full flex flex-col min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Message</h2>
                    </div>
                    <div className="flex items-center gap-3 justify-center">
                        <div className="flex justify-end px-5 pt-3 pb-0">
                            <div className="relative">
                                <select
                                    className="border border-[#CDCDCD] rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed pr-8"
                                    value={status}
                                    onChange={(e) => {
                                        const newStatus = e.target.value as "Change Status" | "Pending" | "Answered" | "Closed";
                                        setStatus(newStatus);
                                        handleStatusChange(newStatus);
                                    }}
                                    disabled={statusMutation.isPending}
                                >
                                    <option>Change Status</option>
                                    <option>Pending</option>
                                    <option>Answered</option>
                                    <option>Closed</option>
                                </select>
                                {statusMutation.isPending && (
                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
                            aria-label="Close"
                        >
                            <img src={images.cross} alt="" className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Ticket Info Card */}
                <div className="px-4 sm:px-5 pt-3 pb-3 shrink-0">
                    <div className="rounded-xl bg-white border border-gray-200 p-4">
                        <div className="grid grid-cols-2 gap-y-3 text-sm">
                            <div className="text-gray-600">Ticket ID</div>
                            <div className="text-right font-semibold text-gray-900 break-words">{ticketMeta.id}</div>

                            <div className="text-gray-600">Subject</div>
                            <div className="text-right font-semibold text-gray-900 break-words">{ticketMeta.subject}</div>

                            <div className="text-gray-600">Customer</div>
                            <div className="text-right font-semibold text-gray-900 break-words">{ticketMeta.userName}</div>

                            <div className="text-gray-600">Opened</div>
                            <div className="text-right font-semibold text-gray-900 break-words">{ticketMeta.opened}</div>

                            <div className="text-gray-600">Status</div>
                            <div className="text-right font-semibold text-gray-900">{ticketMeta.status}</div>
                        </div>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="px-4 sm:px-5 pb-3 flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y">
                    {isLoading ? (
                        <div className="text-center text-gray-500 py-8">Loading messages...</div>
                    ) : isError ? (
                        <div className="text-center text-red-500 py-8">Failed to load messages.</div>
                    ) : (
                        <div
                            ref={listRef}
                            className="flex flex-col gap-3 mt-1 pr-1"
                        >
                            {messages.map((m) => (
                                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className="flex flex-col max-w-[78%]">
                                        <div
                                            className={
                                                m.role === "user"
                                                    ? "self-end bg-[#273E8E] text-white px-4 py-2 rounded-2xl rounded-tr-md shadow-sm text-sm"
                                                    : "self-start bg-[#F3F3F3] text-gray-900 px-4 py-2 rounded-2xl rounded-tl-md shadow-sm text-sm"
                                            }
                                        >
                                            {m.text}
                                        </div>
                                        <span
                                            className={`mt-1 text-[11px] ${
                                                m.role === "user" ? "self-end text-gray-400" : "self-start text-gray-400"
                                            }`}
                                        >
                                            {m.at}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Message Input - stick to bottom */}
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 bg-white border-t border-gray-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Type your message..."
                            className="flex-1 border border-[#CDCDCD] rounded-full px-4 py-3 text-sm focus:outline-none"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={onInputKey}
                            disabled={sendMutation.isPending}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || sendMutation.isPending}
                            className="p-2 rounded-full bg-[#273E8E] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1e3270] transition"
                            aria-label="Send message"
                        >
                            <svg width="22" height="22" fill="none" stroke="white" viewBox="0 0 24 24">
                                <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketDetailModal;
