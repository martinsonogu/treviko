import Image from 'next/image';
import type { Exercise } from '@/lib/training/types';
export default function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  if (exercise.media.status === 'verified' && exercise.media.images.length) {
    return <div className="exerciseMedia">{exercise.media.images.map(image => <figure key={image.position}>
      <Image src={image.src} alt={image.alt} width={640} height={400} sizes="(max-width: 650px) 100vw, 50vw" />
      <figcaption>{image.position === 'start' ? 'Starting position' : 'Finishing position'} · <a href={image.source}>{image.license}</a></figcaption>
    </figure>)}</div>;
  }
  return <figure className="mediaPlaceholder">
    <svg viewBox="0 0 600 180" role="img" aria-label={`Placeholder for ${exercise.name}. Verified movement images are unavailable; this graphic does not demonstrate the exercise.`}>
      <rect width="600" height="180" rx="12" fill="#e4efe6" />
      <path d="M270 64h60v52h-60z M278 108l14-17 10 11 8-8 13 14" fill="none" stroke="#60846b" strokeWidth="3" />
      <circle cx="313" cy="77" r="4" fill="#60846b" />
      <text x="300" y="146" textAnchor="middle" fill="#3f7655" fontSize="15">Verified movement images unavailable</text>
    </svg>
    <figcaption><strong>{exercise.name}</strong> · Media placeholder, not a movement demonstration.</figcaption>
  </figure>;
}
