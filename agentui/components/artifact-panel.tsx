"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Artifact,
  ArtifactHeader,
  ArtifactTitle,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
} from "@/components/ai-elements/artifact";
import {
  JSXPreview,
  JSXPreviewContent,
  JSXPreviewError,
} from "@/components/ai-elements/jsx-preview";
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockCopyButton,
  CodeBlockActions,
} from "@/components/ai-elements/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BundledLanguage } from "shiki";

interface ArtifactPanelProps {
  code: string;
  onClose: () => void;
}

function isFullHtmlDocument(code: string): boolean {
  const trimmed = code.trimStart().toLowerCase();
  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
}

function isDataUrl(code: string): boolean {
  return code.startsWith("data:image/");
}

function HtmlIframePreview({ code }: { code: string }) {
  const srcDoc = useMemo(() => code, [code]);
  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      className="h-full w-full border-0 bg-white"
      title="HTML Preview"
    />
  );
}

export function ArtifactPanel({ code, onClose }: ArtifactPanelProps) {
  const [tab, setTab] = useState("preview");
  const [width, setWidth] = useState(40);
  const dragging = useRef(false);
  const isImage = isDataUrl(code);
  const isHtml = !isImage && isFullHtmlDocument(code);
  const codeLanguage: BundledLanguage = isHtml ? "html" : "tsx";
  const fileName = isHtml ? "page.html" : "component.tsx";

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const pct = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      setWidth(Math.min(80, Math.max(20, pct)));
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const title = isImage ? "Image Preview" : isHtml ? "HTML Preview" : "JSX Preview";

  return (
    <div className="relative min-w-[320px] border-l" style={{ width: `${width}%` }}>
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute -left-1 top-0 z-10 flex h-full w-3 cursor-col-resize items-center justify-center hover:bg-primary/10"
      >
        <div className="h-8 w-1 rounded-full bg-muted-foreground/40" />
      </div>
      <Artifact className="flex h-full flex-col rounded-none border-0">
        <ArtifactHeader>
          <ArtifactTitle>{title}</ArtifactTitle>
          <ArtifactActions>
            <ArtifactClose onClick={onClose} />
          </ArtifactActions>
        </ArtifactHeader>

        {isImage ? (
          <ArtifactContent className="flex h-full items-center justify-center overflow-auto p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={code}
              alt="Report preview"
              className="max-h-full max-w-full object-contain"
            />
          </ArtifactContent>
        ) : (
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="border-b px-4">
              <TabsList className="h-9 bg-transparent">
                <TabsTrigger value="preview" className="text-xs">
                  Preview
                </TabsTrigger>
                <TabsTrigger value="code" className="text-xs">
                  Code
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="preview"
              className="flex-1 overflow-auto p-0 mt-0"
            >
              <ArtifactContent className="h-full">
                {isHtml ? (
                  <HtmlIframePreview code={code} />
                ) : (
                  <JSXPreview jsx={code}>
                    <JSXPreviewContent className="min-h-[200px]" />
                    <JSXPreviewError />
                  </JSXPreview>
                )}
              </ArtifactContent>
            </TabsContent>

            <TabsContent
              value="code"
              className="flex-1 overflow-auto p-0 mt-0"
            >
              <CodeBlock
                code={code}
                language={codeLanguage}
                className="rounded-none border-0"
              >
                <CodeBlockHeader>
                  <CodeBlockTitle>
                    <span className="font-mono text-xs">{fileName}</span>
                  </CodeBlockTitle>
                  <CodeBlockActions>
                    <CodeBlockCopyButton />
                  </CodeBlockActions>
                </CodeBlockHeader>
              </CodeBlock>
            </TabsContent>
          </Tabs>
        )}
      </Artifact>
    </div>
  );
}
