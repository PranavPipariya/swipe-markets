"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { TopNav } from "~~/components/TopNav";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

// helper to display ETH nicely
function fmtEth4(bi: bigint | undefined) {
  if (bi === undefined) return "...";
  const num = Number(bi) / 1e18;
  return num.toFixed(4);
}

const PortfolioPage = () => {
  const { address: connectedAddress } = useAccount();

  // always provide something to the hook so TS stays happy
  const safeAddr = connectedAddress ?? "0x0000000000000000000000000000000000000000";

  // getUserPositions(address) -> uint256[] of positionIds
  const { data: myPositionIds } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "getUserPositions",
    args: [safeAddr],
  });

  // write hook for claim()
  const { writeContractAsync: writeYourContractAsync } = useScaffoldWriteContract({
    contractName: "YourContract",
  });

  async function handleClaim(posId: bigint) {
    try {
      await writeYourContractAsync({
        functionName: "claim",
        args: [posId],
      });
    } catch (err) {
      console.error("claim failed:", err);
    }
  }

  // subcomponent to render each position card
  function PositionCard({ posId }: { posId: bigint }) {
    // positions[posId] struct in YOUR contract:
    // struct Position {
    //   address trader;     // 0
    //   uint256 marketId;   // 1
    //   bool    sideYes;    // 2
    //   uint256 marginWei;  // 3  <-- margin first
    //   uint8   leverage;   // 4  <-- leverage next
    //   bool    claimed;    // 5
    // }
    const { data: posData } = useScaffoldReadContract({
      contractName: "YourContract",
      functionName: "positions",
      args: [posId],
    });

    const trader = (posData?.[0] as string | undefined) ?? undefined;
    const marketId = (posData?.[1] as bigint | undefined) ?? undefined;
    const sideYes = (posData?.[2] as boolean | undefined) ?? undefined;
    const marginWei = (posData?.[3] as bigint | undefined) ?? undefined;
    const leverage = (posData?.[4] as number | bigint | undefined) ?? undefined;
    const claimed = (posData?.[5] as boolean | undefined) ?? undefined;

    // Market struct:
    // struct Market {
    //   string  question;        // 0
    //   uint256 deadline;        // 1
    //   bool    resolved;        // 2
    //   bool    outcomeYes;      // 3
    //   uint256 totalYesMargin;  // 4
    //   uint256 totalNoMargin;   // 5
    //   uint256 totalYesEff;     // 6
    //   uint256 totalNoEff;      // 7
    //   bool    active;          // 8
    // }
    const safeMarketId = marketId ?? 0n;
    const { data: mktData } = useScaffoldReadContract({
      contractName: "YourContract",
      functionName: "markets",
      args: [safeMarketId],
    });

    const question = (mktData?.[0] as string | undefined) ?? undefined;
    const deadline = mktData ? Number(mktData[1]) : undefined;
    const resolved = (mktData?.[2] as boolean | undefined) ?? undefined;
    const outcomeYes = (mktData?.[3] as boolean | undefined) ?? undefined;
    const isActive = (mktData?.[8] as boolean | undefined) ?? undefined;

    // status text logic
    let statusMsg = "Active ⏳";
    if (!isActive && !resolved) {
      statusMsg = "Locked / Waiting";
    }
    if (resolved) {
      const youWon = sideYes === outcomeYes;
      statusMsg = youWon ? "Resolved: You Won ✅" : "Resolved: You Lost ❌";
    }

    const canClaim = Boolean(resolved && !claimed);

    const sideLabel = sideYes ? "YES 💛" : "NO ❌";

    return (
      <div className="w-full rounded-[1.5rem] shadow-xl bg-white border border-black/10 p-6">
        {/* header row */}
        <div className="text-[11px] font-semibold text-black/60 mb-1">Position #{posId.toString()}</div>

        <div className="text-base font-extrabold text-black leading-snug mb-3">{question ?? "(loading...)"}</div>

        {/* chips */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* status pill */}
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#FFC72A] text-black border border-black/20 shadow-[0_2px_0_rgba(0,0,0,0.25)]">
            {statusMsg}
          </span>

          {/* side + leverage pill */}
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#FFFBEA] text-black border border-black/20 shadow-[0_2px_0_rgba(0,0,0,0.05)]">
            {sideLabel} • {String(leverage)}x
          </span>

          {/* stake pill */}
          <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-white text-black border border-black/20 shadow-[0_2px_0_rgba(0,0,0,0.05)]">
            Stake {fmtEth4(marginWei)} ETH
          </span>
        </div>

        {/* details */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div className="text-left">
            <div className="text-[10px] text-black/60 uppercase font-semibold">Trader</div>
            <div className="font-mono text-[11px] break-all text-black">{trader ?? "..."}</div>
          </div>

          <div className="text-left">
            <div className="text-[10px] text-black/60 uppercase font-semibold">Deadline (unix)</div>
            <div className="font-mono text-[11px] text-black">{deadline ?? "..."}</div>
          </div>
        </div>

        {/* status / claim copy */}
        <div className="text-[12px] text-black/80 leading-snug mb-4">
          {resolved ? (
            sideYes === outcomeYes ? (
              claimed ? (
                <>You won and already claimed 🤑</>
              ) : (
                <>You won. Claim now to pull your payout.</>
              )
            ) : (
              <>This one didn’t hit 😵</>
            )
          ) : (
            <>Still live. Once it resolves, you can claim here.</>
          )}
        </div>

        {/* claim CTA */}
        {canClaim ? (
          <button
            className="w-full rounded-full bg-[#FFC72A] text-black text-sm font-extrabold px-4 py-2 shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-[1px] active:shadow-[0_2px_0_rgba(0,0,0,0.25)] transition-transform"
            onClick={() => handleClaim(posId)}
          >
            Claim winnings
          </button>
        ) : claimed ? (
          <div className="w-full text-center text-[11px] text-black/50 font-semibold">Claimed ✅</div>
        ) : (
          <div className="w-full text-center text-[11px] text-black/50 font-semibold">Not claimable yet</div>
        )}

        <div className="text-[9px] text-black/40 leading-snug mt-4 text-center">
          Claim pays directly from contract → you.
        </div>
      </div>
    );
  }

  // build list of cards or "empty"
  const renderedList = useMemo(() => {
    if (!myPositionIds || myPositionIds.length === 0) {
      return (
        <div className="w-full rounded-[1.5rem] shadow-xl bg-white border border-black/10 p-6 text-center">
          <div className="text-base font-extrabold text-black leading-snug mb-2">No positions yet</div>
          <div className="text-[12px] text-black/70 leading-snug">Place a YES 💛 / NO ❌ swipe on Home first.</div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6 items-center w-full">
        {myPositionIds.map((pid: bigint) => (
          <PositionCard key={pid.toString()} posId={pid} />
        ))}
      </div>
    );
  }, [myPositionIds]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFBEA] text-black">
      <TopNav />

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6 w-full max-w-md mx-auto">
        <div className="text-center">
          <h1 className="text-xl font-extrabold leading-tight">Your Positions</h1>
          <p className="text-[12px] text-black/70 leading-snug mt-2">
            These are your swipes. If you won and the market’s resolved, tap claim to pull your payout.
          </p>
        </div>

        {renderedList}

        <div className="text-[10px] text-black/40 leading-snug text-center pb-16">
          You can withdraw your bankroll from the Home screen anytime.
        </div>
      </main>
    </div>
  );
};

export default PortfolioPage;
