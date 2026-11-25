export function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading academic data">
      <div className="pb-5 border-b border-[#D3D1CE]">
        <div className="h-3 w-44 rounded bg-[#D3D1CE]/60" />
        <div className="mt-2.5 h-8 w-64 rounded bg-[#D3D1CE]/70" />
        <div className="mt-2 h-3.5 w-80 max-w-full rounded bg-[#D3D1CE]/50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 luxury-card rounded-xl p-6 h-[320px] flex flex-col justify-between">
          <div className="h-4 w-36 rounded bg-[#EDEAE6]" />
          <div className="mx-auto w-36 h-36 rounded-full border-8 border-[#EDEAE6]" />
          <div className="h-8 w-full rounded bg-[#EDEAE6]" />
        </div>
        <div className="lg:col-span-7 luxury-card rounded-xl p-6 h-[320px] space-y-5">
          <div className="h-4 w-48 rounded bg-[#EDEAE6]" />
          <div className="h-14 w-full rounded bg-[#EDEAE6]" />
          <div className="h-14 w-full rounded bg-[#EDEAE6]" />
          <div className="h-14 w-full rounded bg-[#EDEAE6]" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="luxury-card rounded-xl p-6 h-[220px] space-y-4">
          <div className="h-4 w-40 rounded bg-[#EDEAE6]" />
          <div className="h-10 w-full rounded bg-[#EDEAE6]" />
          <div className="h-10 w-full rounded bg-[#EDEAE6]" />
        </div>
        <div className="luxury-card rounded-xl p-6 h-[220px] space-y-4">
          <div className="h-4 w-40 rounded bg-[#EDEAE6]" />
          <div className="h-10 w-full rounded bg-[#EDEAE6]" />
          <div className="h-10 w-full rounded bg-[#EDEAE6]" />
        </div>
      </div>
    </div>
  );
}
