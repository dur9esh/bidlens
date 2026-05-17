import { ChatView } from "./_components/chat-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ask the agent — BidLens",
  description:
    "Open-ended Q&A grounded in the full BidLens corpus — every answer cited to its source.",
};

export default function AskPage() {
  // sessionId is generated client-side on first render. The demo is anonymous;
  // a fresh session per visit avoids cross-visitor confusion.
  return <ChatView />;
}
