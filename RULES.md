# Autopilot, Restake and StakePilot: the rules

Every rule below is enforced in this repository's code, the same for every wallet. The planner is `keeper/keeper.py`
(the pilot); the app's own planner for previews and StakePilot is in `bin/app.js`; the signer that checks each request
again on its own is `vps/atomone-autopilot-signer/server.mjs`.

**Audit it on chain.** Every Autopilot and Restake transaction is an `x/authz` `MsgExec` sent by one public address,
the grantee **`atone1j7u4528vu28cl6950kqtl60wdl5djed6x47yms`**. Its full history is public in any AtomOne explorer.

## Why the rules look like this

AtomOne's Nakamoto Bonus gives every validator the **same** share of rewards, split across that validator's stake. So a
validator's APR is set by its stake: more stake, lower APR. Moving stake from large validators to small ones earns the
delegator more and spreads the network.

**Autopilot keeps the order of the set.** It fills the smallest validators from the bottom up and never lifts any
validator past one that stood more than 300 ATONE above it. The order of the set, and so the order of APRs, stays as it
was: a smaller validator never ends up paying less than a larger one because of Autopilot. Only near-ties can swap
places: validators within 300 ATONE of each other, about 0.1% of their stake, whose APRs are practically the same.

## What you grant

| Service | Grant | What it can do |
|---|---|---|
| Autopilot | `StakeAuthorization`, redelegate only, no cap, no expiry | move your stake between validators |
| Restake | `StakeAuthorization`, delegate, plus permission to claim your rewards | claim your rewards and stake them back |

Neither can send, unstake or vote. Revoke in one click, any time, in the app or any wallet. Transaction fees for both
are paid by us in PHOTON; nothing is ever taken from you.

### The jailed-validators box
Ticked by default ("Recommended"): validators **jailed 3 or more times ever, or 2 or more times in the last 90 days**
are left out. The list is computed from chain history at every data build: a validator joins it after such a jailing
and leaves on its own once it has 90 clean days (3 or more jailings in total never expire). Your choice is written in
the grant's memo (`GATA AtomOne Autopilot` or `GATA AtomOne Autopilot, all validators`), so it is public too. It is set
when you activate and fixed while active: to change it, revoke and activate again. Grants without a memo count as ticked.

## When Autopilot runs

- Each wallet is planned at **00:00 and 12:00 UTC**, and at once when the grant is new or changed.
- When a validator is jailed or drops out of the active set, every Autopilot wallet holding stake on it is moved off in
  the same check, not at the next 12-hour run.
- First come, first served: wallets are planned in the order their grants were made, and each move is counted into the
  set before the next wallet is planned, so the same room is never filled twice.
- Nothing runs on stale data: the chain head must be fresh and the set is read from the chain every time.

## Where stake may go

All of these must hold:
1. In the active set, bonded and not jailed.
2. Not in the largest fifth of the set (ranks 1 to 20 of 100).
3. Above the bottom guard: every slot down to the last may be used, except one slot for each **returning validator**,
   one that left the set in the last 21 days (jailed or dropped, not tombstoned) and holds more stake than the
   validator at that slot. If it came back, it would push that validator out of the set and strand the stake there.
   If this list cannot be read, the last 3 slots are held instead.
4. Not on the jailed list, if your box is ticked.
5. Allowed by your grant's own validator list, if it has one.
6. Fewer than 7 unfinished redelegations between that source and destination (a chain limit).

## How much goes where

- **Water fill from the bottom:** the smallest allowed validator rises first, to 300 ATONE under the one above it; then
  the two rise together, each 300 ATONE under the one above, and so on up.
- **The order is kept** as described above (300-ATONE levels). A plan that would break it is refused whole.
- **0 or 100 ATONE:** every delegation a move touches ends at zero or at 100 ATONE or more. Small pieces are gathered
  into one; a source is never left holding 1 to 99 ATONE; a wallet moving under 100 ATONE in all uses one validator.
  No move is under 1 ATONE, and no dust is left behind.

## When stake moves

1. **Always, from any rank:** stake on a validator on the jailed list (box ticked), or on a validator outside the active
   set (it earns nothing). All of its free stake leaves.
2. **For gain:** when the move earns at least **3 APR points** more on the stake that moves, and at least 1 ATONE a year.
   The gain counts the whole wallet, including the stake already on the destination.
3. **Never:** stake under AtomOne's 21-day redelegation lock. The chain also refuses any redelegation out of a validator
   that received a redelegation from you in the last 21 days, so that whole delegation waits for the date.

## Limits

- At most 60 moves per wallet in any 24 hours, and per transaction.
- Fees per wallet capped at 8 PHOTON a day.
- A failure that means the grant or the stake is gone holds the wallet for 24 hours; network or fee failures are retried
  after 10 minutes, 30 minutes and an hour.

## Restake

- Every 12 hours (00:00 and 12:00 UTC), from **1 ATONE** of rewards. Rewards must be paid to your own address.
- Claims from the validators with the largest rewards first, at most 18 per transaction (the rest next time).
- **Stakes every claimed ATONE back**, onto your **own** delegations: the best-paying ones you hold on allowed validators,
  at most 2 per run, as far as the order of the set allows. Only a wallet with no such delegation gets one new delegation,
  which later runs top up. Restake never spreads your rewards over many new validators.
- Allowed validators: the same as Autopilot's (active set, not the largest fifth, above the bottom guard). The jailed
  list follows Restake's own box, except that a wallet whose Autopilot leaves the jailed out has Restake leave them out
  too, so rewards are never staked where Autopilot would move them off.

## StakePilot

StakePilot is Autopilot by hand, for ATONE you have not staked yet: the same destinations, the same water fill, the same
order of the set and the same 0-or-100 rule, with its own jailed-validators box (ticked by default; the plan redraws as
you change it). You sign the stake yourself.

## What the signer checks on its own

The grantee key lives on a separate host. Whatever the pilot asks, the signer:
- reads every needed grant from the chain first and refuses when it is missing or about to expire;
- sends a move only to a bonded, unjailed validator inside the allowed ranks (its own read of the bottom guard), and only
  out of stake the wallet actually holds;
- stakes rewards only when they are paid to the delegator's own address, and never more than the rewards it claims, so it
  can never touch anyone's liquid ATONE;
- counts every move against the 60-a-day limit, simulates every transaction before signing, and refuses anything that is
  not exactly one `MsgExec` for one delegator;
- cannot send, unstake, vote or grant.
