"use client";

import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isStreaming: boolean;
  onSubmit: (text: string) => void;
  onStop: () => void;
}

export function ChatInput({
  input,
  setInput,
  isStreaming,
  onSubmit,
  onStop,
}: ChatInputProps) {
  return (
    <div className="border-t p-4">
      <div className="mx-auto max-w-3xl">
        <PromptInput
          onSubmit={(message) => {
            if (message.text.trim()) {
              onSubmit(message.text);
            }
          }}
        >
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Austin 311 data..."
          />
          <PromptInputFooter>
            <div />
            <PromptInputSubmit
              status={isStreaming ? "streaming" : "ready"}
              onStop={onStop}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
