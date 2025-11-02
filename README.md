# swipe-markets

Leverage-on-swipe prediction markets - swipe to place bets.

Demo video: [https://youtu.be/aQY6ZULaLfo](https://youtu.be/aQY6ZULaLfo)

---

## What is this?

This is a fully on-chain yes/no prediction market with fixed leverage where you “swipe” on a market like you’d swipe on a dating profile.

* You connect your wallet
* You load funds into your in-app bankroll
* You get shown ONE active market as a card
* You choose **YES 💛** (swipe right / long) or **NO ❌** (swipe left / short)
* You pick leverage (2x / 5x / 10x)
* After the market is resolved, if you were right you can claim your payout on-chain straight to your wallet

The frontend is a Bumble-style UI, and all money logic lives on a single Solidity contract called `YourContract.sol`.

This repo uses the Scaffold-ETH 2 stack:

* `packages/hardhat` → smart contract, deploy script, local chain
* `packages/nextjs` → Next.js app (RainbowKit + wagmi + Tailwind UI / Bumble skin)

You can run this locally, deploy your own markets, and immediately play with fake ETH on localhost or a testnet.

---

## Core ideas

### 1. Internal bankroll, not direct betting

Users first “deposit” ETH into an internal balance on the contract:

```solidity
function depositUserBalance() external payable;
```

That balance is what they risk when they swipe YES/NO.

They can also withdraw leftover balance anytime:

```solidity
function withdrawUserBalance(uint256 amountWei) external;
```

Important: this is **not** just sending ETH to the contract. You MUST call `depositUserBalance()` so your internal balance gets credited.

### 2. Leverage bets (2x / 5x / 10x)

When you “swipe” (open a position), you lock a margin (your stake) from your balance and choose leverage:

```solidity
function openPosition(
    uint256 marketId,
    bool sideYes,      // YES=long=true / NO=short=false
    uint8 leverage,    // 2,5,10 only
    uint256 marginWei  // how much of your balance to risk
) external;
```

* If you're right:
  you get back your stake **+ a slice of the loser pool**, weighted by leverage.
* If you're wrong:
  you lose only what you staked (your margin).
  Liquidation is just “you lost the bet.”

### 3. One swipe per round

UX-wise we treat it like this:
You swipe once for the currently active market. After that:

* the card disappears / locks for you,
* you can track that position in **Portfolio**.

This simulates “you made your call, now wait”.

### 4. Admin resolves the market

The admin (contract owner) calls:

```solidity
function resolveMarket(uint256 marketId, bool outcomeYes) external;
```

After resolution, winners can claim:

```solidity
function claim(uint256 positionId) external;
```

`claim()` pays ETH **directly to your wallet**, not back into your internal balance.

### 5. Bumble-style frontend

* Yellow/black “dating app energy”
* Mobile-first card
* Leverage pills
* “YES 💛” / “NO ❌” buttons showing est. payout and max loss
* A Portfolio tab that shows all of your previous swipes and lets you claim winnings

---

## Security warning

This is hackathon-grade.
**Do not deploy this to mainnet with real funds.**

Known sharp edges:

* There is an `owner` and the contract still includes an **old `withdraw()` function** from Scaffold-ETH that lets the owner drain all ETH in the contract. That was part of the original scaffold contract and was intentionally not removed.
* No oracle / no on-chain resolution logic. The admin (you) decides truth manually.
* No slippage / oracle manipulation protection / MEV handling / etc.
* Payout math is simple pool-split, not audited.

Treat this as a prototype demo, not production DeFi.

---

## Repo layout

```text
.
├── packages
│   ├── hardhat        # Solidity contract, deploy scripts, local chain setup
│   └── nextjs         # Frontend (Next.js App Router + RainbowKit + wagmi)
├── package.json       # root workspace config
├── yarn.lock
└── .gitignore
```

### Contract of interest

`packages/hardhat/contracts/YourContract.sol`

This file:

* tracks balances per user
* creates markets
* lets users open leveraged YES/NO positions
* lets winners claim
* lets users withdraw their unspent balance

---

## Prereqs

You’ll need:

* Node 18+
* Yarn (classic or berry is fine; Scaffold-ETH 2 defaults to `yarn`)
* A browser wallet (Metamask etc.)

To run locally with a local Hardhat node you **do not** need Alchemy / Infura / keys — you can just use the local chain.

---

## 1. Install dependencies

From repo root:

```bash
yarn install
```

This will install dependencies for both `packages/hardhat` and `packages/nextjs` because this is a monorepo.

---

## 2. Run a local blockchain

In a separate terminal tab:

```bash
cd packages/hardhat
yarn chain
```

That runs Hardhat in dev mode and gives you local accounts funded with test ETH.

Keep that running.

---

## 3. Deploy the contract locally

Open a **second** terminal tab:

```bash
cd packages/hardhat
yarn deploy
```

What this does:

* deploys `YourContract` to the local chain
* sets the deployer as the `owner`
* logs the initial setup

The Scaffold-ETH tooling will also write the deployed ABI / address into `packages/nextjs` so the frontend can talk to it automatically.

If you change the contract and redeploy, rerun `yarn deploy`.

---

## 4. Run the frontend

Open a **third** terminal tab:

```bash
cd packages/nextjs
yarn dev
```

Then open [http://localhost:3000](http://localhost:3000) in browser.

You’ll see:

* **TopNav** with Connect Wallet / links
* **Bankroll card** where you can deposit and withdraw
* **Active Market card** where you can bet
* **Portfolio** (at `/portfolio`) where you see and claim your settled bets
* **Admin page** (at `/admin`) where you can create and resolve markets (must be connected as the owner)

---

## 5. How to use the app (as a normal user)

1. **Connect wallet** in the top nav.

   * If you’re on localhost, connect using one of the local Hardhat private keys (Metamask → import private key from the ones printed by `yarn chain`).
   * Network: localhost / Hardhat (chain id 31337).

2. **Load funds (“bankroll”)**
   On the Home screen:

   * Enter e.g. `0.05` ETH into “Add funds”.
   * Click `Deposit`.
   * This calls `depositUserBalance()` and moves 0.05 ETH from your wallet into your internal balance in the contract.

   You’ll now see “Your Bankroll: 0.0500 ETH” etc.

3. **Swipe YES 💛 or NO ❌**
   Still on Home:

   * You’ll see the current market question (e.g. “Will ETH > $4000 by Nov 10?”).
   * Pick leverage (2x / 5x / 10x).
   * Enter stake (like `0.01`).
   * Press `YES 💛` or `NO ❌`.

   That triggers `openPosition(...)` on the contract.
   After you do this:

   * That card will “lock” and you won’t be allowed to bet again in that round.
   * Your position is recorded on-chain.
   * You’ll see it under `/portfolio`.

4. **View / claim in Portfolio**
   Go to `/portfolio`:

   * You’ll see all your previous swipes.
   * After the market is resolved and you were correct, you’ll get a **Claim winnings** button.
   * Clicking that calls `claim(positionId)` on-chain.
   * Your payout (stake + your share of the loser side) is sent **directly to your wallet**.

5. **Withdraw unused balance**
   Back on Home (Bankroll card):

   * Put an amount into “Cash out”.
   * Click `Withdraw`.
   * That calls `withdrawUserBalance(amountWei)`.
   * That sends that much ETH from your internal bankroll back to your wallet.

---

## 6. Admin / Owner flow

The wallet that deployed the contract is the `owner`. That wallet gets extra controls.

Go to `/admin` in the app.

### Create a market

Form fields:

* **Question** (string shown to users on the swipe card)
* **Deadline (seconds from now)** or absolute timestamp depending on how you wired it

This calls:

```solidity
createMarket(string question, uint256 deadline)
```

and pushes a new active market.

The latest market is what shows up to users on Home.

### Resolve a market

After the deadline passes:

* Pick who actually “won”: YES or NO.
* Click Resolve.

This calls:

```solidity
resolveMarket(marketId, outcomeYes)
```

Once resolved:

* Users on the correct side can call `claim()` from /portfolio.

---

## 7. Payout math (intuitive version)

Let’s say:

* You stake 0.01 ETH at 5x leverage on YES.
* Others stake a bunch on YES and NO.

When the market resolves:

* If YES wins:

  * YES traders split all the NO-side margin.
  * The split is proportional to `(your stake * your leverage)` / `(total YES stake * leverage of everyone who said YES)`.
  * You always get your original stake back too.
* If YES loses:

  * You lose only the margin you staked (0.01 in this example).

So you’re not getting liquidated “more than what you put in”. Max loss = the stake you chose.

---

## 8. FAQ / gotchas

**Q: I can’t click YES/NO, buttons are disabled.**
A: You probably haven’t deposited bankroll yet.
Deposit ETH using the “Add funds” card first. The UI disables betting if your in-contract balance is 0.

**Q: I clicked YES but the card disappeared. Bug?**
A: That’s intentional. After one swipe in the active market, you’re “locked in”. You’ll see that position in `/portfolio`.

**Q: Why is the owner allowed to drain the whole contract?**
A: Because we kept the original Scaffold-ETH `withdraw()` function on purpose for transparency and didn’t strip anything. This is not production-safe. Do not deploy on mainnet with real money.

**Q: Can I deploy this to a public testnet?**
Yes. Steps:

1. Add an RPC + private key to `packages/hardhat/hardhat.config.ts`.
2. Fund that wallet with testnet ETH.
3. Run:

   ```bash
   cd packages/hardhat
   yarn deploy --network <yourTestnetName>
   ```
4. Update the frontend to point at that network (wagmi/RPC config).
5. Connect with Metamask on that testnet.

---

## 9. TL;DR dev loop

Terminal 1:

```bash
cd packages/hardhat
yarn chain
```

Terminal 2:

```bash
cd packages/hardhat
yarn deploy
```

Terminal 3:

```bash
cd packages/nextjs
yarn dev
```

Browser:

* [http://localhost:3000](http://localhost:3000) → Home (deposit + swipe UI)
* [http://localhost:3000/portfolio](http://localhost:3000/portfolio) → Your bets and claim
* [http://localhost:3000/admin](http://localhost:3000/admin) → Market creation + resolution (owner only)

---

## 10. Status

This project is a working prototype:

* It proves the UX: “swiping” a market like you swipe a person.
* It gives fixed simple leverage, and transparent pool-split payouts.
* It’s chain-backed: all money flow is in Solidity.
* It’s mobile-friendly and demoable (see video).

Do not use this with real money in production.
Fork it, break it, ship your own version.
