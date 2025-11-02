"use client";

import { useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export function ActiveMarketCard() {
  const { address: connectedAddress } = useAccount();

  // --------------------------------------------------
  // 1. Read latest market (we always show the newest one)
  // --------------------------------------------------
  const { data: marketsLen } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "marketsLength",
    args: [],
  });

  const latestMarketIdNum = useMemo(() => {
    if (!marketsLen) return undefined;
    const n = Number(marketsLen);
    if (n === 0) return undefined;
    return n - 1;
  }, [marketsLen]);

  const safeMarketId = latestMarketIdNum !== undefined ? latestMarketIdNum : 0;

  const { data: latestMarket } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "markets",
    args: [BigInt(safeMarketId)],
  });

  // Market struct layout in YourContract:
  // 0 question        string
  // 1 deadline        uint256
  // 2 resolved        bool
  // 3 outcomeYes      bool
  // 4 totalYesMargin  uint256
  // 5 totalNoMargin   uint256
  // 6 totalYesEff     uint256
  // 7 totalNoEff      uint256
  // 8 active          bool
  const question = latestMarket ? (latestMarket[0] as string) : "(no market)";
  const deadline = latestMarket ? Number(latestMarket[1]) : 0;
  const resolved = latestMarket ? (latestMarket[2] as boolean) : false;
  const outcomeYes = latestMarket ? (latestMarket[3] as boolean) : false;
  const totalYesMargin = latestMarket ? (latestMarket[4] as bigint) : 0n;
  const totalNoMargin = latestMarket ? (latestMarket[5] as bigint) : 0n;
  const totalYesEff = latestMarket ? (latestMarket[6] as bigint) : 0n;
  const totalNoEff = latestMarket ? (latestMarket[7] as bigint) : 0n;
  const isActive = latestMarket ? (latestMarket[8] as boolean) : false;

  const nowSec = Math.floor(Date.now() / 1000);
  const secondsLeft = deadline > 0 ? Math.max(deadline - nowSec, 0) : 0;

  // --------------------------------------------------
  // 2. User context: balance, positions, lockout
  // --------------------------------------------------
  const safeAddr = connectedAddress ?? "0x0000000000000000000000000000000000000000";

  // on-chain bankroll
  const { data: userBalanceWei } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "getUserBalance",
    args: [safeAddr],
  });
  const userBalanceBig = userBalanceWei ? (userBalanceWei as bigint) : 0n;
  const userBalanceEth = Number(formatEther(userBalanceBig)).toFixed(4);

  // have they already opened a position?
  const { data: myPositionIds } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "getUserPositions",
    args: [safeAddr],
  });

  const hasAnyPositions = useMemo(() => {
    return myPositionIds && myPositionIds.length > 0;
  }, [myPositionIds]);

  // local lock after successful bet (so it hides instantly)
  const [justBet, setJustBet] = useState(false);
  const userLockedOut = hasAnyPositions || justBet;

  // --------------------------------------------------
  // 3. Bet builder UI (stake + leverage)
  // --------------------------------------------------
  const [stakeEth, setStakeEth] = useState<string>("0.01");
  const [leverage, setLeverage] = useState<2 | 5 | 10>(5);

  const { writeContractAsync: writeYourContractAsync } = useScaffoldWriteContract({
    contractName: "YourContract",
  });

  // convert user-input ETH to wei bigint
  const stakeWei: bigint | null = useMemo(() => {
    if (!stakeEth || Number(stakeEth) <= 0) return null;
    try {
      return parseEther(stakeEth);
    } catch {
      return null;
    }
  }, [stakeEth]);

  const stakeEthNum = useMemo(() => {
    const n = Number(stakeEth);
    return isNaN(n) ? 0 : n;
  }, [stakeEth]);

  // check "do you even have this much in your internal balance?"
  const hasEnoughBalance = useMemo(() => {
    if (stakeWei === null) return false;
    return userBalanceBig >= stakeWei;
  }, [userBalanceBig, stakeWei]);

  // --------------------------------------------------
  // 4. Implied vibes / odds (from pooled leverage)
  // --------------------------------------------------
  const yesSharePct = useMemo(() => {
    const yesEff = Number(totalYesEff);
    const noEff = Number(totalNoEff);
    const denom = yesEff + noEff;
    if (denom === 0) return 50;
    return (yesEff / denom) * 100;
  }, [totalYesEff, totalNoEff]);

  const noSharePct = useMemo(() => 100 - yesSharePct, [yesSharePct]);

  // --------------------------------------------------
  // 5. Win payout simulations
  // --------------------------------------------------
  function simulateYesPayoutEth() {
    if (stakeWei === null) return null;

    // Your effective weight if you choose YES:
    const traderEff = stakeWei * BigInt(leverage);

    // if YES wins, NO side is the loser pool
    const totalYesEffPrime = totalYesEff + traderEff;
    const loserPool = totalNoMargin;
    const winnerEffTotalPrime = totalYesEffPrime === 0n ? 1n : totalYesEffPrime;

    // bonus from loser side
    const bonusWei = (traderEff * loserPool) / winnerEffTotalPrime;

    // stake back + bonus
    const payoutWei = stakeWei + bonusWei;

    return {
      winPayoutEth: Number(formatEther(payoutWei)).toFixed(4),
      maxLossEth: stakeEthNum.toFixed(4),
    };
  }

  function simulateNoPayoutEth() {
    if (stakeWei === null) return null;

    // your weight on NO
    const traderEff = stakeWei * BigInt(leverage);

    // if NO wins, YES side is loser pool
    const totalNoEffPrime = totalNoEff + traderEff;
    const loserPool = totalYesMargin;
    const winnerEffTotalPrime = totalNoEffPrime === 0n ? 1n : totalNoEffPrime;

    const bonusWei = (traderEff * loserPool) / winnerEffTotalPrime;

    const payoutWei = stakeWei + bonusWei;

    return {
      winPayoutEth: Number(formatEther(payoutWei)).toFixed(4),
      maxLossEth: stakeEthNum.toFixed(4),
    };
  }

  const yesSim = simulateYesPayoutEth();
  const noSim = simulateNoPayoutEth();

  // --------------------------------------------------
  // 6. Fire the bet (openPosition)
  // --------------------------------------------------
  async function handleBet(sideYes: boolean) {
    // sanity checks before tx
    if (latestMarketIdNum === undefined) {
      console.warn("no market");
      return;
    }
    if (!connectedAddress) {
      console.warn("wallet not connected");
      return;
    }
    if (stakeWei === null || Number(stakeEth) <= 0) {
      console.warn("bad stake");
      return;
    }
    if (!hasEnoughBalance) {
      console.warn("NO_FUNDS (frontend)");
      return;
    }

    try {
      await writeYourContractAsync({
        functionName: "openPosition",
        args: [
          BigInt(latestMarketIdNum), // marketId
          sideYes, // YES or NO
          leverage, // 2 | 5 | 10
          stakeWei, // marginWei
        ],
      });

      // lock them out visually right away
      setJustBet(true);
    } catch (err) {
      console.error("openPosition failed:", err);
    }
  }

  // --------------------------------------------------
  // 7. RENDER
  // --------------------------------------------------

  // No markets at all
  if (latestMarketIdNum === undefined) {
    return (
      <div className="w-full max-w-sm rounded-[1.5rem] shadow-xl bg-white border border-black/10 p-6 text-center">
        <div className="text-lg font-extrabold leading-snug mb-1">No live markets yet 👀</div>
        <div className="text-[12px] text-black/70 leading-snug">Check back soon.</div>
      </div>
    );
  }

  // chips row (conviction + timer)
  const ChipsRow = (
    <div className="flex flex-wrap justify-center gap-2 mb-5">
      <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#FFC72A] text-black border border-black/10 shadow-[0_2px_0_rgba(0,0,0,0.2)]">
        YES vibe {yesSharePct.toFixed(1)}%
      </span>

      <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-red-100 text-red-700 border border-red-300 shadow-[0_2px_0_rgba(0,0,0,0.05)]">
        NO vibe {noSharePct.toFixed(1)}%
      </span>

      <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-black text-white border border-black/10 shadow-[0_2px_0_rgba(0,0,0,0.6)]">
        ends in {secondsLeft}s
      </span>
    </div>
  );

  // If market is closed OR user already bet → locked view
  if (!isActive || userLockedOut) {
    return (
      <div className="w-full max-w-sm rounded-[1.5rem] shadow-xl bg-white border border-black/10 p-6 text-center">
        <div className="text-base font-extrabold leading-snug mb-3">{question}</div>

        {ChipsRow}

        {!isActive ? (
          resolved ? (
            <div className="text-sm font-bold mb-2">
              Final: <span className="font-extrabold">{outcomeYes ? "YES 💛" : "NO ❌"}</span>
            </div>
          ) : (
            <div className="text-sm font-semibold text-black/70 mb-2">Waiting for resolution…</div>
          )
        ) : (
          <>
            <div className="text-sm font-bold text-black mb-1">You’re in 🫡</div>
            <div className="text-[12px] text-black/70 leading-snug">
              Watch + claim in{" "}
              <a className="underline font-semibold" href="/portfolio">
                Portfolio
              </a>
              .
            </div>
          </>
        )}

        <div className="text-[10px] text-black/50 leading-snug mt-5">One position per round. No double swiping.</div>
      </div>
    );
  }

  // Active market, user hasn't bet yet → full swipe UI
  return (
    <div className="w-full max-w-sm rounded-[1.5rem] shadow-xl bg-white border border-black/10 p-6 text-center">
      {/* question like Bumble bio prompt */}
      <div className="text-base font-extrabold leading-snug mb-3">{question}</div>

      {ChipsRow}

      {/* bankroll + stake + leverage */}
      <div className="flex flex-col items-center gap-4 mb-6 w-full">
        {/* leverage selector */}
        <div className="flex gap-2">
          {[2, 5, 10].map(lv => (
            <button
              key={lv}
              className={`px-4 py-2 rounded-full text-sm font-extrabold border shadow-[0_2px_0_rgba(0,0,0,0.2)] ${
                leverage === lv ? "bg-[#FFC72A] text-black border-black/20" : "bg-[#FFFBEA] text-black border-black/20"
              }`}
              onClick={() => setLeverage(lv as 2 | 5 | 10)}
            >
              {lv}x
            </button>
          ))}
        </div>

        {/* stake input + balance readout */}
        <div className="flex flex-col items-center text-center">
          <label className="text-[11px] font-semibold text-black/70 mb-1">Your stake (ETH)</label>
          <input
            className="w-24 text-center rounded-full border border-black/20 bg-[#FFFBEA] px-3 py-2 text-sm font-extrabold text-black placeholder:text-black/40 focus:outline-none"
            value={stakeEth}
            onChange={e => setStakeEth(e.target.value)}
            placeholder="0.01"
          />

          <div className="text-[10px] text-black/60 mt-1 leading-snug max-w-[10rem]">Max loss = just this stake.</div>

          <div className="text-[10px] text-black/80 mt-2 leading-snug">
            Your balance: <span className="font-mono font-extrabold">{userBalanceEth} ETH</span>
          </div>

          {!hasEnoughBalance && (
            <div className="text-[10px] text-red-600 font-semibold mt-2">
              Not enough balance. Add funds on Home first.
            </div>
          )}
        </div>
      </div>

      {/* swipe actions YES / NO */}
      <div className="grid grid-cols-2 gap-4">
        {/* YES */}
        <button
          className="rounded-[1rem] flex flex-col items-center px-3 py-4 border border-black/20 bg-[#FFC72A] text-black shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-[1px] active:shadow-[0_2px_0_rgba(0,0,0,0.25)] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!connectedAddress || stakeWei === null || !hasEnoughBalance}
          onClick={() => handleBet(true)}
        >
          <div className="text-sm font-extrabold mb-1">YES 💛</div>
          <div className="text-[11px] font-semibold leading-tight">
            Win ~ <span className="font-mono font-extrabold">{yesSim ? yesSim.winPayoutEth : "--"} ETH</span>
          </div>
          <div className="text-[10px] text-black/70 leading-tight">Risk {yesSim ? yesSim.maxLossEth : "--"} ETH</div>
        </button>

        {/* NO */}
        <button
          className="rounded-[1rem] flex flex-col items-center px-3 py-4 border border-red-300 bg-red-50 text-red-700 shadow-[0_4px_0_rgba(0,0,0,0.08)] active:translate-y-[1px] active:shadow-[0_2px_0_rgba(0,0,0,0.08)] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!connectedAddress || stakeWei === null || !hasEnoughBalance}
          onClick={() => handleBet(false)}
        >
          <div className="text-sm font-extrabold mb-1">NO ❌</div>
          <div className="text-[11px] font-semibold leading-tight text-center">
            Win ~ <span className="font-mono font-extrabold text-red-700">{noSim ? noSim.winPayoutEth : "--"} ETH</span>
          </div>
          <div className="text-[10px] text-red-600/70 leading-tight">Risk {noSim ? noSim.maxLossEth : "--"} ETH</div>
        </button>
      </div>

      <div className="text-[10px] text-black/50 leading-snug mt-5">
        Upside = your stake + your slice of the losers’ pool. Leverage makes your slice bigger if you’re right.
      </div>
    </div>
  );
}
