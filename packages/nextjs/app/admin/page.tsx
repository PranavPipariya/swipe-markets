"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { TopNav } from "~~/components/TopNav";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const AdminPage = () => {
  const { address: connectedAddress } = useAccount();

  // read owner from contract
  const { data: ownerAddr } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "owner",
    args: [],
  });

  const isOwner = useMemo(() => {
    if (!connectedAddress || !ownerAddr) return false;
    return connectedAddress.toLowerCase() === (ownerAddr as string).toLowerCase();
  }, [connectedAddress, ownerAddr]);

  // form state
  const [question, setQuestion] = useState<string>("");
  const [minutesFromNow, setMinutesFromNow] = useState<string>("5"); // default 5 min

  // write hook
  const { writeContractAsync: writeYourContractAsync } = useScaffoldWriteContract({
    contractName: "YourContract",
  });

  async function handleCreateMarket() {
    const minsNum = Number(minutesFromNow) || 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const deadline = BigInt(nowSec + minsNum * 60);

    try {
      await writeYourContractAsync({
        functionName: "createMarket",
        args: [question, deadline],
      });

      // reset form
      setQuestion("");
      setMinutesFromNow("5");
    } catch (err) {
      console.error("createMarket failed:", err);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFBEA] text-black">
      <TopNav />

      <main className="flex-1 flex flex-col items-center px-4 py-8 w-full max-w-md mx-auto gap-6">
        <div className="text-center">
          <div className="text-xl font-extrabold leading-tight">Admin Panel</div>
          <div className="text-[12px] text-black/70 leading-snug mt-2">
            Create new markets. Only the contract owner can do this.
          </div>
        </div>

        {!isOwner ? (
          // NOT OWNER
          <div className="w-full rounded-[1.5rem] shadow-xl bg-white border border-black/10 p-6 text-center">
            <div className="text-base font-extrabold text-black leading-snug mb-2">Not authorized</div>
            <div className="text-[12px] text-black/70 leading-snug">Connect the owner wallet to manage markets.</div>
            <div className="text-[10px] text-black/40 leading-snug mt-4">
              (Only owner can resolve markets, create markets, etc.)
            </div>
          </div>
        ) : (
          // OWNER VIEW: CREATE MARKET FORM
          <div className="w-full rounded-[1.5rem] shadow-xl bg-white border border-black/10 p-6">
            <div className="text-sm font-extrabold text-black leading-snug mb-4 text-center">New Market</div>

            <label className="text-[11px] font-semibold text-black/70 mb-1 block">Question / Prompt</label>
            <textarea
              className="w-full rounded-xl border border-black/20 bg-[#FFFBEA] text-black text-sm font-semibold p-3 placeholder:text-black/40 focus:outline-none"
              rows={3}
              placeholder={`"BTC > $100k by midnight?"`}
              value={question}
              onChange={e => setQuestion(e.target.value)}
            />

            <div className="mt-4 flex flex-col">
              <label className="text-[11px] font-semibold text-black/70 mb-1">Closes in (minutes from now)</label>
              <input
                className="w-24 rounded-full border border-black/20 bg-[#FFFBEA] text-black text-sm font-extrabold px-3 py-2 placeholder:text-black/40 focus:outline-none"
                value={minutesFromNow}
                onChange={e => setMinutesFromNow(e.target.value)}
              />
              <div className="text-[10px] text-black/50 leading-snug mt-1">
                We convert this to a unix timestamp on-chain.
              </div>
            </div>

            <button
              onClick={handleCreateMarket}
              disabled={!question}
              className="w-full mt-6 rounded-full bg-[#FFC72A] text-black text-sm font-extrabold px-4 py-2 shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-[1px] active:shadow-[0_2px_0_rgba(0,0,0,0.25)] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Launch Market
            </button>

            <div className="text-[10px] text-black/40 leading-snug mt-4 text-center">
              After launch: go Home, refresh, and you’ll see this as the live swipe card for users.
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPage;
