"use client";

import { useMemo, useState } from "react";
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
  const isHtml = isFullHtmlDocument(code);
  const codeLanguage: BundledLanguage = isHtml ? "html" : "tsx";
  const fileName = isHtml ? "page.html" : "component.tsx";

  return (
    <div className="w-[40%] min-w-[320px] border-l">
      <Artifact className="flex h-full flex-col rounded-none border-0">
        <ArtifactHeader>
          <ArtifactTitle>{isHtml ? "HTML Preview" : "JSX Preview"}</ArtifactTitle>
          <ArtifactActions>
            <ArtifactClose onClick={onClose} />
          </ArtifactActions>
        </ArtifactHeader>

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
      </Artifact>
    </div>
  );
}
