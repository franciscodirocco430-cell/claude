"use client";

import * as React from "react";
import { UploadCloud, FileVideo, FileImage, FileText, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ACCEPTED_VIDEO_TYPES,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_TEXT_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/validations/content";

export type SourceKind = "file" | "text" | "url";

export interface SelectedFile {
  file: File;
  kind: "video" | "image" | "text";
  previewUrl: string;
  durationSeconds: number | null;
  thumbnailDataUrl: string | null;
  /** base64 (no data: prefix) — only set for images, used for real vision analysis. */
  imageBase64: string | null;
  /** May differ from file.type when the image was downscaled/recompressed to fit the request size limit. */
  imageMediaType: string | null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Returns the image ready for the request: as-is (base64) if it already fits
 * the server's size limit, or downscaled/re-encoded as JPEG at decreasing
 * quality until it does. This lets people upload real phone photos (often
 * 8-20MB) without hitting Vercel's fixed 4.5MB serverless body limit or
 * rejecting the upload outright.
 */
async function prepareImageForUpload(
  file: File
): Promise<{ base64: string; mediaType: string }> {
  if (file.size <= MAX_IMAGE_SIZE_BYTES) {
    const dataUrl = await readFileAsDataUrl(file);
    return { base64: dataUrl.split(",")[1] ?? "", mediaType: file.type };
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image."));
    img.src = dataUrl;
  });

  const maxDimension = 2000;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const compressed = canvas.toDataURL("image/jpeg", quality);
    const base64 = compressed.split(",")[1] ?? "";
    if (base64.length <= MAX_IMAGE_SIZE_BYTES * 1.4) {
      return { base64, mediaType: "image/jpeg" };
    }
  }

  // Still too large even at the lowest quality — shrink further as a last resort.
  canvas.width = Math.round(canvas.width * 0.6);
  canvas.height = Math.round(canvas.height * 0.6);
  ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const finalCompressed = canvas.toDataURL("image/jpeg", 0.5);
  return { base64: finalCompressed.split(",")[1] ?? "", mediaType: "image/jpeg" };
}

interface UploadZoneProps {
  sourceKind: SourceKind;
  onSourceKindChange: (kind: SourceKind) => void;
  selectedFile: SelectedFile | null;
  onFileSelected: (file: SelectedFile | null) => void;
  rawText: string;
  onRawTextChange: (text: string) => void;
  url: string;
  onUrlChange: (url: string) => void;
  error: string | null;
}

const ALL_ACCEPTED = [...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_TEXT_TYPES];

function detectKind(file: File): "video" | "image" | "text" | null {
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return "video";
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return "image";
  if (ACCEPTED_TEXT_TYPES.includes(file.type) || file.name.endsWith(".md")) return "text";
  return null;
}

async function buildVideoPreview(file: File): Promise<{ duration: number | null; thumbnail: string | null }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(video.src);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration / 2);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
        resolve({ duration: video.duration, thumbnail });
      } catch {
        resolve({ duration: video.duration || null, thumbnail: null });
      } finally {
        cleanup();
      }
    };
    video.onerror = () => {
      cleanup();
      resolve({ duration: null, thumbnail: null });
    };
  });
}

export function UploadZone({
  sourceKind,
  onSourceKindChange,
  selectedFile,
  onFileSelected,
  rawText,
  onRawTextChange,
  url,
  onUrlChange,
  error,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [processingPreview, setProcessingPreview] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    setFileError(null);

    const kind = detectKind(file);
    if (!kind) {
      setFileError(
        `"${file.name}" isn't a supported format. Use MP4/MOV/WEBM/M4V for video, JPG/PNG/WEBP for images, or TXT/MD for text.`
      );
      return;
    }

    if (kind === "video") {
      setProcessingPreview(true);
      const { duration, thumbnail } = await buildVideoPreview(file);
      setProcessingPreview(false);
      onFileSelected({
        file,
        kind,
        previewUrl: URL.createObjectURL(file),
        durationSeconds: duration,
        thumbnailDataUrl: thumbnail,
        imageBase64: null,
        imageMediaType: null,
      });
    } else if (kind === "image") {
      setProcessingPreview(true);
      try {
        const { base64, mediaType } = await prepareImageForUpload(file);
        onFileSelected({
          file,
          kind,
          previewUrl: URL.createObjectURL(file),
          durationSeconds: null,
          thumbnailDataUrl: null,
          imageBase64: base64,
          imageMediaType: mediaType,
        });
      } catch {
        setFileError(`Couldn't process "${file.name}". Try a different image.`);
      } finally {
        setProcessingPreview(false);
      }
    } else {
      const text = await file.text();
      onRawTextChange(text);
      onFileSelected({
        file,
        kind,
        previewUrl: "",
        durationSeconds: null,
        thumbnailDataUrl: null,
        imageBase64: null,
        imageMediaType: null,
      });
    }
  };

  return (
    <Tabs
      defaultValue="file"
      value={sourceKind === "file" ? "file" : sourceKind}
      onValueChange={(v) => onSourceKindChange(v as SourceKind)}
    >
      <TabsList>
        <TabsTrigger value="file">Upload file</TabsTrigger>
        <TabsTrigger value="text">Paste content</TabsTrigger>
        <TabsTrigger value="url">URL</TabsTrigger>
      </TabsList>

      <TabsContent value="file">
        {selectedFile ? (
          <div className="flex items-center gap-4 rounded-card border border-white/[0.08] bg-surface-card p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.04]">
              {selectedFile.kind === "video" && selectedFile.thumbnailDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedFile.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
              ) : selectedFile.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedFile.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : selectedFile.kind === "video" ? (
                <FileVideo className="h-6 w-6 text-muted-foreground" />
              ) : (
                <FileText className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{selectedFile.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.file.size / (1024 * 1024)).toFixed(1)} MB
                {selectedFile.durationSeconds
                  ? ` · ${Math.round(selectedFile.durationSeconds)}s`
                  : ""}
              </p>
            </div>
            <button
              onClick={() => onFileSelected(null)}
              aria-label="Remove file"
              className="rounded-lg p-2 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-card-lg border-2 border-dashed p-14 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-white/[0.12] bg-surface-card hover:border-white/20"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ALL_ACCEPTED.join(",")}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20">
              <UploadCloud className="h-6 w-6 text-primary" />
            </div>
            <p className="font-display text-lg font-semibold">
              {processingPreview ? "Reading file..." : "Upload your content"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Analyze videos, reels, images, carousels and long-form content with AI.
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <FileVideo className="h-3.5 w-3.5" /> MP4, MOV, WEBM, M4V
              <FileImage className="ml-2 h-3.5 w-3.5" /> JPG, PNG, WEBP
              <FileText className="ml-2 h-3.5 w-3.5" /> TXT, MD
            </p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="text">
        <Textarea
          label="Paste your caption, script, post or article"
          value={rawText}
          onChange={(e) => onRawTextChange(e.target.value)}
          placeholder="Paste your content here..."
          className="min-h-[220px]"
        />
      </TabsContent>

      <TabsContent value="url">
        <div className="space-y-3">
          <Input
            label="Content URL"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://instagram.com/reel/..."
          />
          <div className="rounded-card border border-white/[0.08] bg-surface-card p-4 text-sm text-muted-foreground">
            URL analysis coming soon. We don&apos;t scrape platforms without an official
            integration — Instagram, TikTok and YouTube URL analysis will use their official
            APIs once available. For now, upload the file or paste the content directly.
          </div>
        </div>
      </TabsContent>

      {(fileError || error) && (
        <p role="alert" className="mt-3 text-xs text-red-400">
          {fileError || error}
        </p>
      )}
    </Tabs>
  );
}
