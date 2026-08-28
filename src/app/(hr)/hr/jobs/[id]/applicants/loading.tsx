import { SkeletonLine, SkeletonList } from '@/components/skeleton';

export default function Loading() {
  return (
    <>
      <div aria-hidden="true" className="mb-6 mt-4">
        <SkeletonLine className="h-8 w-48" />
        <SkeletonLine className="mt-3 h-3.5 w-72 max-w-full" />
      </div>
      <div aria-hidden="true" className="card mb-6">
        <SkeletonLine className="h-2.5 w-full rounded-full" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonLine key={index} className="h-6 w-20" />
          ))}
        </div>
      </div>
      <SkeletonList label="Loading applicants…" />
    </>
  );
}
