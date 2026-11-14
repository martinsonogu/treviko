"use client";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { getApprovedIllustration } from "@/lib/training/illustrations/approved";

export function IllustrationImage({
  src,
  alt,
  width,
  height,
  fallback,
  preview = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  fallback: ReactNode;
  preview?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return fallback;
  return (
    <figure className="exerciseIllustration" style={{ margin: 0, width: "100%" }}>
      <Image
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          aspectRatio: "1",
          objectFit: "contain",
          borderRadius: 12,
          background: "#18211f",
        }}
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(max-width: 650px) 100vw, (max-width: 1100px) 50vw, 650px"
        loading="lazy"
        unoptimized={preview}
        onError={() => setFailed(src)}
      />
      {preview ? (
        <figcaption style={{ padding: ".5rem .75rem", fontSize: ".85rem" }}>
          Draft — pending anatomical and rights review. Not approved for training guidance.
        </figcaption>
      ) : (
        <figcaption
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clipPath: "inset(50%)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          Treviko — AI-generated using ChatGPT. Licensed under CC BY 4.0:
          https://creativecommons.org/licenses/by/4.0/
        </figcaption>
      )}
    </figure>
  );
}

export default function ExerciseIllustration({
  exerciseId,
  fallback = null,
}: {
  exerciseId: string;
  fallback?: ReactNode;
}) {
  const asset = getApprovedIllustration(exerciseId);
  if (!asset) return fallback;
  return (
    <IllustrationImage
      {...asset}
      fallback={
        fallback ?? (
          <p className="muted">Illustration unavailable. Use the exercise instructions.</p>
        )
      }
    />
  );
}
