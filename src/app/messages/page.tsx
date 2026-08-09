"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { getActiveUsers, getUserTasks, sendMessageAction, updateLeaveRequestStatusAction } from "@/lib/messages/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  title: string;
  content: string;
  type: "direct" | "announcement" | "leave_request" | "task_clarification";
  task_id: string | null;
  leave_date: string | null;
  is_emergency_checkout: boolean;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  sender: { name: string; email: string } | null;
  recipient: { name: string; email: string } | null;
}

function messageTypeLabel(msg: Message): string {
  if (msg.is_emergency_checkout) return "Emergency Checkout";
  return msg.type.replace("_", " ");
}

interface TaskItem {
  id: string;
  title: string;
}

export default function MessagesPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "sent" | "compose">("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [composeType, setComposeType] = useState<string>("direct");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Get current profile
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("users")
          .select("id, name, email, role")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data as UserProfile);
          });
      }
    });

    // Load compose helpers
    getActiveUsers().then(setUsers);
    getUserTasks().then(setTasks);
  }, [supabase]);

  // Load messages
  useEffect(() => {
    if (!profile) return;

    supabase
      .from("messages")
      .select(`
        id, sender_id, recipient_id, title, content, type, task_id, leave_date, is_emergency_checkout, status, created_at,
        sender:users!messages_sender_id_fkey(name, email),
        recipient:users!messages_recipient_id_fkey(name, email)
      `)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load messages:", error.message);
        } else {
          setMessages((data as unknown as Message[]) ?? []);
        }
      });
  }, [profile, activeTab, supabase]);

  const handleComposeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSending) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSending(true);

    const formData = new FormData(e.currentTarget);
    const result = await sendMessageAction(formData);

    setIsSending(false);
    if (result.error) {
      setErrorMsg(result.error);
    } else {
      setSuccessMsg("Message sent successfully!");
      setActiveTab("sent");
      e.currentTarget.reset();
      setComposeType("direct");
    }
  };

  const handleStatusChange = async (messageId: string, status: "approved" | "rejected") => {
    const result = await updateLeaveRequestStatusAction(messageId, status);
    if (result.error) {
      alert(result.error);
    } else {
      setSelectedMessage((prev) => (prev ? { ...prev, status } : null));
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status } : msg))
      );
    }
  };

  if (!profile) {
    return <div className="text-center py-8">Loading profile...</div>;
  }

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  const inboxMessages = messages.filter(
    (msg) => msg.recipient_id === profile.id || msg.recipient_id === null
  );
  const sentMessages = messages.filter((msg) => msg.sender_id === profile.id);

  const getBadgeClass = (status: string) => {
    if (status === "approved") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (status === "rejected") return "bg-destructive/20 text-destructive border-destructive/30";
    return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  };

  return (
    <div className="grid gap-6 md:grid-cols-4 max-w-6xl mx-auto py-8">
      {/* Navigation Sidebar */}
      <div className="space-y-2 md:col-span-1">
        <button
          onClick={() => {
            setActiveTab("inbox");
            setSelectedMessage(null);
          }}
          className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "inbox" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground"
          }`}
        >
          Inbox ({inboxMessages.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("sent");
            setSelectedMessage(null);
          }}
          className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "sent" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground"
          }`}
        >
          Sent ({sentMessages.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("compose");
            setSelectedMessage(null);
          }}
          className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "compose" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground"
          }`}
        >
          Compose Message
        </button>
      </div>

      {/* Main Panel */}
      <div className="md:col-span-3">
        {activeTab === "compose" && (
          <Card>
            <CardHeader>
              <CardTitle>Compose message</CardTitle>
            </CardHeader>
            <CardContent>
              {errorMsg && <p className="text-sm text-destructive mb-4">{errorMsg}</p>}
              {successMsg && <p className="text-sm text-green-500 mb-4">{successMsg}</p>}

              <form onSubmit={handleComposeSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="type">Message type</Label>
                    <select
                      id="type"
                      name="type"
                      required
                      value={composeType}
                      onChange={(e) => setComposeType(e.target.value)}
                      className="glass-card flex h-10 w-full rounded-md px-3 py-2 text-sm"
                    >
                      <option value="direct">Direct Message</option>
                      <option value="leave_request">Leave Request</option>
                      <option value="task_clarification">Task Clarification</option>
                      {isAdmin && <option value="announcement">Announcement</option>}
                    </select>
                  </div>

                  {composeType !== "announcement" && (
                    <div className="space-y-2">
                      <Label htmlFor="recipient_id">Recipient</Label>
                      <select
                        id="recipient_id"
                        name="recipient_id"
                        required
                        className="glass-card flex h-10 w-full rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">Select user</option>
                        {users
                          .filter((u) => u.id !== profile.id)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.role === "member" ? "Employee" : "Admin"})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {composeType === "leave_request" && (
                    <div className="space-y-2">
                      <Label htmlFor="leave_date">Leave date</Label>
                      <Input id="leave_date" name="leave_date" type="date" required />
                    </div>
                  )}

                  {composeType === "task_clarification" && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="task_id">Associated task</Label>
                      <select
                        id="task_id"
                        name="task_id"
                        required
                        className="glass-card flex h-10 w-full rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">Select task</option>
                        {tasks.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Subject</Label>
                  <Input id="title" name="title" placeholder="e.g. Leave request for Monday / Clarification on API spec" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Message details</Label>
                  <Textarea id="content" name="content" rows={5} placeholder="Write your message here..." required />
                </div>

                <Button type="submit" disabled={isSending}>
                  {isSending ? "Sending message..." : "Send message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {(activeTab === "inbox" || activeTab === "sent") && (
          <div className="grid gap-4">
            {/* Split view if a message is selected */}
            {selectedMessage ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                  <div>
                    <button
                      onClick={() => setSelectedMessage(null)}
                      className="text-xs text-muted-foreground hover:underline mb-2 block"
                    >
                      &larr; Back to list
                    </button>
                    <CardTitle className="text-xl">{selectedMessage.title}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p>
                        <strong>From:</strong>{" "}
                        {selectedMessage.sender_id === profile.id
                          ? "You"
                          : selectedMessage.sender?.name ?? "Unknown"}
                      </p>
                      {selectedMessage.recipient_id && (
                        <p>
                          <strong>To:</strong>{" "}
                          {selectedMessage.recipient_id === profile.id
                            ? "You"
                            : selectedMessage.recipient?.name ?? "Unknown"}
                        </p>
                      )}
                      <p>
                        <strong>Type:</strong>{" "}
                        {messageTypeLabel(selectedMessage).toUpperCase()}
                      </p>
                      {selectedMessage.type === "leave_request" && selectedMessage.leave_date && (
                        <p>
                          <strong>Leave date:</strong> {selectedMessage.leave_date}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(selectedMessage.created_at)}
                    </span>
                    {selectedMessage.type === "leave_request" && (
                      <span
                        className={`block text-[10px] font-bold border px-2 py-0.5 rounded-full mt-2 text-center w-24 ml-auto ${getBadgeClass(
                          selectedMessage.status
                        )}`}
                      >
                        {selectedMessage.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                    {selectedMessage.content}
                  </div>

                  {selectedMessage.task_id && (
                    <div className="bg-accent/30 border border-border p-3 rounded-lg flex items-center justify-between">
                      <span className="text-xs font-semibold">Clarification Task Link:</span>
                      <a
                        href={`/tasks/${selectedMessage.task_id}`}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        View associated task &rarr;
                      </a>
                    </div>
                  )}

                  {/* Admin Approval flow for leave request */}
                  {selectedMessage.type === "leave_request" &&
                    selectedMessage.status === "pending" &&
                    isAdmin &&
                    selectedMessage.sender_id !== profile.id && (
                      <div className="flex gap-4 border-t border-border pt-6">
                        <button
                          onClick={() => handleStatusChange(selectedMessage.id, "approved")}
                          className="bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded hover:bg-green-700 transition-colors"
                        >
                          Approve Request
                        </button>
                        <button
                          onClick={() => handleStatusChange(selectedMessage.id, "rejected")}
                          className="bg-destructive text-destructive-foreground text-xs font-semibold px-4 py-2 rounded hover:bg-destructive/90 transition-colors"
                        >
                          Reject Request
                        </button>
                      </div>
                    )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="capitalize">{activeTab}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-border">
                    {(activeTab === "inbox" ? inboxMessages : sentMessages).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No messages found.
                      </p>
                    ) : (
                      (activeTab === "inbox" ? inboxMessages : sentMessages).map((msg) => (
                        <div
                          key={msg.id}
                          onClick={() => setSelectedMessage(msg)}
                          className="py-3 px-2 hover:bg-accent/30 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-4"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-primary capitalize">
                                {messageTypeLabel(msg)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {activeTab === "inbox"
                                  ? msg.sender_id === profile.id
                                    ? "You"
                                    : msg.sender?.name ?? "Announcement"
                                  : msg.recipient?.name ?? "Public"}
                              </span>
                            </div>
                            <h3 className="text-sm font-semibold truncate">{msg.title}</h3>
                            <p className="text-xs text-muted-foreground truncate max-w-md">
                              {msg.content}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(msg.created_at)}
                            </span>
                            {msg.type === "leave_request" && (
                              <span
                                className={`block text-[9px] font-bold border px-1.5 py-0.5 rounded-full mt-1 ${getBadgeClass(
                                  msg.status
                                )}`}
                              >
                                {msg.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}