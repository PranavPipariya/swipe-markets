"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { ActiveMarketCard } from "~~/components/ActiveMarketCard";
import { TopNav } from "~~/components/TopNav";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const HomePage = () => {
  const { address: connectedAddress } = useAccount();

  const safeAddr = connectedAddress ?? "0x0000000000000000000000000000000000000000";

  // read balance
  const { data: userBalanceWei } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "getUserBalance",
    args: [safeAddr],
  });

  const numericBal = userBalanceWei ? Number(userBalanceWei) / 1e18 : 0;

  const userBalanceEth = userBalanceWei ? (Number(userBalanceWei) / 1e18).toFixed(4) : "0.0000";

  const { writeContractAsync: writeYourContractAsync } = useScaffoldWriteContract({
    contractName: "YourContract",
  });

  const [depositAmountEth, setDepositAmountEth] = useState<string>("");
  const [withdrawAmountEth, setWithdrawAmountEth] = useState<string>("");

  async function handleDeposit() {
    if (!depositAmountEth) return;
    try {
      await writeYourContractAsync({
        functionName: "depositUserBalance",
        args: [],
        value: parseEther(depositAmountEth),
      });
      setDepositAmountEth("");
    } catch (err) {
      console.error("deposit failed:", err);
    }
  }

  async function handleWithdraw() {
    if (!withdrawAmountEth) return;
    try {
      await writeYourContractAsync({
        functionName: "withdrawUserBalance",
        args: [parseEther(withdrawAmountEth)],
      });
      setWithdrawAmountEth("");
    } catch (err) {
      console.error("withdraw failed:", err);
    }
  }

  // UI
  return (
    <div className="min-h-screen flex flex-col bg-[#FFFBEA] text-black">
      {/* bright yellow nav */}
      <TopNav />

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-8 w-full">
        {/* balance card */}
        <section className="w-full max-w-sm rounded-[1.5rem] shadow-xl bg-white border border-black/10 p-6 text-center">
          <div className="text-[11px] font-semibold text-black/60 mb-1">your in-app balance</div>
          <div className="text-4xl font-extrabold font-mono tracking-tight">{userBalanceEth} ETH</div>
          <div className="text-[11px] text-black/70 leading-snug mt-2">
            This is what you play with. You can cash out any time.
          </div>
        </section>

        {/* ONBOARD: no funds yet */}
        {numericBal <= 0 ? (
          <section className="w-full max-w-sm rounded-[1.5rem] shadow-xl bg-white border border-black/10 p-6 text-center">
            <div className="text-lg font-extrabold leading-snug mb-2">Add funds to start matching ⚡</div>

            <div className="text-[12px] text-black/70 leading-snug mb-4">
              Drop a little ETH into your balance so you can take a side (YES 💛 or NO ❌) on live markets.
            </div>

            <div className="flex flex-col items-center gap-3">
              <input
                className="w-28 text-center rounded-full border border-black/20 bg-[#FFFBEA] px-3 py-2 text-sm font-semibold text-black placeholder:text-black/40 focus:outline-none"
                placeholder="0.01"
                value={depositAmountEth}
                onChange={e => setDepositAmountEth(e.target.value)}
              />
              <button
                className="w-full max-w-[10rem] rounded-full bg-[#FFC72A] text-black text-sm font-extrabold px-4 py-2 shadow-[0_4px_0_rgba(0,0,0,0.2)] active:translate-y-[1px] active:shadow-[0_2px_0_rgba(0,0,0,0.2)] transition-transform"
                onClick={handleDeposit}
                disabled={!connectedAddress || depositAmountEth === ""}
              >
                Add Funds
              </button>
            </div>

            <div className="text-[10px] text-black/50 leading-snug mt-4">
              We escrow inside the contract. You can pull it back later.
            </div>
          </section>
        ) : (
          <>
            {/* FUNDED: show swipe card */}
            <section className="w-full flex flex-col items-center">
              <ActiveMarketCard />
            </section>

            {/* withdraw/manage section */}
            <section className="w-full max-w-sm rounded-[1.5rem] shadow-xl bg-white border border-black/10 p-6">
              <div className="text-center text-sm font-extrabold mb-4">Cash out / adjust bankroll</div>

              <div className="flex flex-col items-center gap-3">
                <input
                  className="w-28 text-center rounded-full border border-black/20 bg-[#FFFBEA] px-3 py-2 text-sm font-semibold text-black placeholder:text-black/40 focus:outline-none"
                  placeholder="0.005"
                  value={withdrawAmountEth}
                  onChange={e => setWithdrawAmountEth(e.target.value)}
                />
                <button
                  className="w-full max-w-[10rem] rounded-full border border-red-400 text-red-600 bg-red-50 text-sm font-extrabold px-4 py-2 shadow-[0_4px_0_rgba(0,0,0,0.08)] active:translate-y-[1px] active:shadow-[0_2px_0_rgba(0,0,0,0.08)] transition-transform"
                  onClick={handleWithdraw}
                  disabled={!connectedAddress || withdrawAmountEth === ""}
                >
                  Withdraw
                </button>
              </div>

              <div className="text-[10px] text-black/50 leading-snug mt-4 text-center">
                Withdraw only affects <b>your</b> balance.
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default HomePage;
