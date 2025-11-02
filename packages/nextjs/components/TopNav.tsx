"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";

export function TopNav() {
  const { address: connectedAddress } = useAccount();

  return (
    <header className="w-full flex items-center justify-between px-4 py-3 border-b border-black/10 bg-[#FFC72A] text-black">
      {/* brand / logo */}
      <div className="text-base font-extrabold leading-none">
        swipe<span className="text-black/60">.markets</span>
      </div>

      {/* nav links */}
      <nav className="flex items-center gap-4 text-xs sm:text-sm font-semibold">
        <Link href="/" className="hover:text-black/60 transition-colors">
          play
        </Link>
        <Link href="/portfolio" className="hover:text-black/60 transition-colors">
          portfolio
        </Link>
        <Link href="/admin" className="text-black/60 hover:text-black/90 transition-colors">
          admin
        </Link>
      </nav>

      {/* wallet badge */}
      <div className="flex flex-col items-end leading-tight">
        <div className="text-[10px] font-semibold text-black/60">connected</div>
        <div className="px-2 py-1 rounded-full bg-white text-[11px] font-mono font-semibold border border-black/10 max-w-[7rem] truncate">
          <Address address={connectedAddress} />
        </div>
      </div>
    </header>
  );
}
