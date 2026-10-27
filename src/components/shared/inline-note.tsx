export type InlineMessage = { tone: "error" | "success"; text: string } | null;

export function InlineNote({ message }: { message: InlineMessage }) {
  if (!message) return null;
  return (
    <p
      role={message.tone === "error" ? "alert" : "status"}
      className={message.tone === "error" ? "text-sm text-destructive" : "text-sm text-emerald-500"}
    >
      {message.text}
    </p>
  );
}
