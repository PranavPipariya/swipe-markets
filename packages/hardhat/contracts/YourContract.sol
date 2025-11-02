//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// Useful for debugging. Remove when deploying to a live network.
import "hardhat/console.sol";

/**
 * ORIGINAL NOTES:
 * A smart contract that allows changing a state variable of the contract and tracking the changes
 * It also allows the owner to withdraw the Ether in the contract
 *
 * EXTENDED:
 * Added swipe-style prediction markets with fixed leverage (2x/5x/10x),
 * user deposit balances, leveraged YES/NO positions, settle + claim,
 * and user-controlled balance withdrawal.
 *
 * SECURITY NOTE:
 * The old withdraw() is still there and still lets owner drain contract ETH.
 * That's part of the original code you gave, and I am not deleting it.
 * For users, there's withdrawUserBalance() which only withdraws THEIR balance.
 *
 * This is hackathon-grade. Do not ship to mainnet like this.
 *
 * @author BuidlGuidl (+ swipe market extensions by you)
 */
contract YourContract {
    // ============================================================
    // == ORIGINAL STATE ==========================================
    // ============================================================

    address public immutable owner;
    string public greeting = "Building Unstoppable Apps!!!";
    bool public premium = false;
    uint256 public totalCounter = 0;
    mapping(address => uint) public userGreetingCounter;

    // Events from original contract
    event GreetingChange(address indexed greetingSetter, string newGreeting, bool premium, uint256 value);

    // Constructor from original contract
    // Check packages/hardhat/deploy/00_deploy_your_contract.ts
    constructor(address _owner) {
        owner = _owner;
    }

    // Modifier from original contract
    modifier isOwner() {
        require(msg.sender == owner, "Not the Owner");
        _;
    }

    /**
     * ORIGINAL FUNCTION:
     * Allows anyone to change "greeting" and tracks counts.
     * Payable to flip premium=true if they send ETH.
     */
    function setGreeting(string memory _newGreeting) public payable {
        // Debug log for local chain only
        console.log("Setting new greeting '%s' from %s", _newGreeting, msg.sender);

        greeting = _newGreeting;
        totalCounter += 1;
        userGreetingCounter[msg.sender] += 1;

        if (msg.value > 0) {
            premium = true;
        } else {
            premium = false;
        }

        emit GreetingChange(msg.sender, _newGreeting, msg.value > 0, msg.value);
    }

    /**
     * ORIGINAL FUNCTION:
     * Owner can withdraw ALL Ether held by the contract.
     * WARNING: This will also include funds users deposited into balances.
     * I'm not removing it because you said don't delete anything.
     */
    function withdraw() public isOwner {
        (bool success, ) = owner.call{ value: address(this).balance }("");
        require(success, "Failed to send Ether");
    }

    /**
     * ORIGINAL receive():
     * Contract can receive ETH directly.
     * NOTE: direct send to contract does NOT credit user internal balance.
     * They must use depositUserBalance() for that.
     */
    receive() external payable {}

    // ============================================================
    // == NEW STUFF STARTS HERE ===================================
    // ============================================================

    // -------------------------
    // simple reentrancy guard
    // -------------------------
    bool private locked;
    modifier nonReentrant() {
        require(!locked, "REENTRANCY");
        locked = true;
        _;
        locked = false;
    }

    // -------------------------
    // per-user internal balance
    // -------------------------
    // Users "load" ETH into the app. We track it here.
    // openPosition() pulls from here.
    // withdrawUserBalance() returns unused funds to the user.
    mapping(address => uint256) public balances;

    // -----------------------------------------------------------
    // MARKET / POSITION STORAGE
    // -----------------------------------------------------------

    struct Market {
        string question;          // e.g. "ETH > $4k by Nov 10?"
        uint256 deadline;         // timestamp after which new positions are blocked
        bool resolved;            // has outcome been finalized?
        bool outcomeYes;          // true => YES(=long/right swipe) wins, false => NO(=short/left swipe) wins
        uint256 totalYesMargin;   // total raw margin (ETH) from YES side
        uint256 totalNoMargin;    // total raw margin (ETH) from NO side
        uint256 totalYesEff;      // sum of margin * leverage for YES
        uint256 totalNoEff;       // sum of margin * leverage for NO
        bool active;              // if false, no new positions
    }

    struct Position {
        address trader;
        uint256 marketId;
        bool sideYes;        // true = YES/long/right swipe, false = NO/short/left swipe
        uint256 marginWei;   // margin taken from user's balance
        uint8 leverage;      // must be 2,5,10
        bool claimed;        // has user already claimed payout?
    }

    // All markets
    Market[] public markets;

    // All positions
    Position[] public positions;

    // Per-user index of their positions (for portfolio UI)
    mapping(address => uint256[]) public userPositionsIdx;

    // -----------------------------------------------------------
    // EVENTS (NEW)
    // -----------------------------------------------------------

    event UserDeposit(address indexed user, uint256 amount);
    event UserWithdraw(address indexed user, uint256 amount);

    event MarketCreated(uint256 indexed marketId, string question, uint256 deadline);
    event MarketResolved(uint256 indexed marketId, bool outcomeYes);

    event PositionOpened(
        address indexed trader,
        uint256 indexed marketId,
        uint256 indexed positionId,
        bool sideYes,
        uint256 marginWei,
        uint8 leverage
    );

    event Claimed(
        address indexed trader,
        uint256 indexed positionId,
        uint256 payoutWei,
        bool won
    );

    // -----------------------------------------------------------
    // USER BALANCE MANAGEMENT
    // -----------------------------------------------------------

    /**
     * @notice User deposits ETH into their internal balance.
     * This is how they "fund" their account in the app.
     */
    function depositUserBalance() external payable {
        require(msg.value > 0, "NO_VALUE");
        balances[msg.sender] += msg.value;
        emit UserDeposit(msg.sender, msg.value);
    }

    /**
     * @notice User withdraws unused balance (not locked in a bet).
     * This is separate from the original owner-only withdraw().
     */
    function withdrawUserBalance(uint256 amountWei) external nonReentrant {
        require(balances[msg.sender] >= amountWei, "INSUFFICIENT_BAL");
        balances[msg.sender] -= amountWei;

        (bool ok, ) = msg.sender.call{value: amountWei}("");
        require(ok, "USER_WITHDRAW_FAIL");

        emit UserWithdraw(msg.sender, amountWei);
    }

    // -----------------------------------------------------------
    // MARKET MANAGEMENT (OWNER ONLY)
    // -----------------------------------------------------------

    /**
     * @notice Owner creates a new swipe market/question.
     * @param _question the market question
     * @param _deadline unix timestamp cutoff for new bets
     */
    function createMarket(string memory _question, uint256 _deadline)
        external
        isOwner
        returns (uint256 marketId)
    {
        require(_deadline > block.timestamp, "BAD_DEADLINE");

        Market memory m;
        m.question = _question;
        m.deadline = _deadline;
        m.resolved = false;
        m.outcomeYes = false;
        m.totalYesMargin = 0;
        m.totalNoMargin = 0;
        m.totalYesEff = 0;
        m.totalNoEff = 0;
        m.active = true;

        markets.push(m);
        marketId = markets.length - 1;

        emit MarketCreated(marketId, _question, _deadline);
    }

    /**
     * @notice Owner finalizes a market's result.
     * @param marketId which market
     * @param outcomeYes_ true => YES wins, false => NO wins
     */
    function resolveMarket(uint256 marketId, bool outcomeYes_) external isOwner {
        Market storage m = markets[marketId];
        require(m.active, "INACTIVE");
        require(!m.resolved, "ALREADY_RESOLVED");
        require(block.timestamp >= m.deadline, "TOO_EARLY");

        m.resolved = true;
        m.outcomeYes = outcomeYes_;
        m.active = false;

        emit MarketResolved(marketId, outcomeYes_);
    }

    // -----------------------------------------------------------
    // OPEN POSITION (USER ACTION)
    // -----------------------------------------------------------

    /**
     * @notice User opens a leveraged YES/NO position in a market.
     *
     * @param marketId Which market to bet on.
     * @param sideYes  true = YES/right swipe (long),
     *                 false = NO/left swipe (short)
     * @param leverage Must be 2,5, or 10 (fixed options only).
     * @param marginWei How much of user's balance to lock in this position.
     *
     * Flow:
     *  - We take marginWei out of user's balances[msg.sender].
     *  - We add it to the correct market pool (+ effective size = marginWei * leverage).
     *  - We record a Position for later claim().
     */
    function openPosition(
        uint256 marketId,
        bool sideYes,
        uint8 leverage,
        uint256 marginWei
    ) external {
        Market storage m = markets[marketId];
        require(m.active, "MARKET_CLOSED");
        require(block.timestamp < m.deadline, "AFTER_DEADLINE");
        require(marginWei > 0, "ZERO_MARGIN");
        require(leverage == 2 || leverage == 5 || leverage == 10, "BAD_LEVERAGE");

        // pull funds from user's available balance
        require(balances[msg.sender] >= marginWei, "NO_FUNDS");
        balances[msg.sender] -= marginWei;

        // update market aggregates
        if (sideYes) {
            m.totalYesMargin += marginWei;
            m.totalYesEff += uint256(marginWei) * uint256(leverage);
        } else {
            m.totalNoMargin += marginWei;
            m.totalNoEff += uint256(marginWei) * uint256(leverage);
        }

        // store the position
        positions.push(
            Position({
                trader: msg.sender,
                marketId: marketId,
                sideYes: sideYes,
                marginWei: marginWei,
                leverage: leverage,
                claimed: false
            })
        );

        uint256 positionId = positions.length - 1;
        userPositionsIdx[msg.sender].push(positionId);

        emit PositionOpened(
            msg.sender,
            marketId,
            positionId,
            sideYes,
            marginWei,
            leverage
        );
    }

    // -----------------------------------------------------------
    // CLAIM / SETTLEMENT
    // -----------------------------------------------------------

    /**
     * @notice Claim result of your position after market is resolved.
     * Payout math:
     *
     *  effectiveSize = marginWei * leverage
     *
     *  Winner side splits losing side's total *margin* pool,
     *  proportional to effectiveSize.
     *
     *  If you win:
     *    payout = marginWei + pro-rata-share-of(loserMarginPool)
     *  If you lose:
     *    payout = 0 (your margin is gone into the pool)
     *
     * We pay out directly to msg.sender wallet, NOT to internal balances[].
     *
     * @param positionId index in `positions`
     */
    function claim(uint256 positionId) external nonReentrant {
        Position storage p = positions[positionId];
        require(p.trader == msg.sender, "NOT_YOURS");
        require(!p.claimed, "ALREADY_CLAIMED");

        Market storage m = markets[p.marketId];
        require(m.resolved, "NOT_RESOLVED");

        // mark claimed first (checks-effects-interactions)
        p.claimed = true;

        bool won = (p.sideYes == m.outcomeYes);
        uint256 payout = 0;

        if (won) {
            // identify pools/effective totals depending on which side won
            uint256 loserMarginPool;
            uint256 winnerEffTotal;

            if (p.sideYes) {
                // YES wins
                loserMarginPool = m.totalNoMargin;
                winnerEffTotal = m.totalYesEff;
            } else {
                // NO wins
                loserMarginPool = m.totalYesMargin;
                winnerEffTotal = m.totalNoEff;
            }

            // this position's effective size
            uint256 traderEff = p.marginWei * uint256(p.leverage);

            // bonus share from loser margin pool
            uint256 bonus = 0;
            if (winnerEffTotal > 0) {
                bonus = (traderEff * loserMarginPool) / winnerEffTotal;
            }

            payout = p.marginWei + bonus;

            (bool ok, ) = msg.sender.call{value: payout}("");
            require(ok, "PAYOUT_FAIL");

            emit Claimed(msg.sender, positionId, payout, true);
        } else {
            // lost -> 0
            emit Claimed(msg.sender, positionId, 0, false);
        }
    }

    // -----------------------------------------------------------
    // VIEW HELPERS FOR FRONTEND
    // -----------------------------------------------------------

    /// @notice number of markets created
    function marketsLength() external view returns (uint256) {
        return markets.length;
    }

    /// @notice number of positions total
    function positionsLength() external view returns (uint256) {
        return positions.length;
    }

    /// @notice return list of caller's position IDs
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositionsIdx[user];
    }

    /// @notice convenience for frontend "available balance"
    function getUserBalance(address user) external view returns (uint256) {
        return balances[user];
    }
}
