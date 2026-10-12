# Nakamoto

A free, public dashboard for AtomOne delegators. Live at **https://atomone.gatahub.zone**.

AtomOne's Nakamoto Bonus splits a share of every staking reward equally across all validators, so the same
ATONE earns more on a smaller validator. Nakamoto makes that incentive visible and turns it into one move.

## What it does

- **Bonus map**: all 100 validators coloured by the APR they really pay, with live what-if sliders for the
  bonus share, stake concentration and total stake; views by APR, stake, rank, logo, bars and a curve.
- **Your move**: connect a wallet (Keplr, Adena, or Ledger through Keplr) and see the same stake's best
  placement as one line: the APR now, the APR after, the gain in ATONE a year, and the exact validators.
- **Autopilot**: one approval, then twice a day stake moves to the best-paying smaller validators, filling
  from the bottom up without changing any validator's rank. The grant is redelegate-only.
- **Restake**: every 12 hours, pending rewards are claimed and staked back onto smaller validators.
- **Governance**: every proposal with its tally and text, voting (Yes / Abstain / No) signed in the wallet,
  your own and your governor's voting record marked per proposal, governors, the core DAOs, and AtomOne's
  constitution pinned to the genesis text.
- **Network**: uptime, live signing, proposers, chain pace and economics, no wallet needed.
- **Wallet tools**: stake, unstake, claim, PHOTON mint at the chain rate, and an Activity view of the
  account's moves, restakes and transactions.
- **Alerts**: a Telegram bot that reports validator misses, rank and APR changes, and each Autopilot move.

## How it holds your stake: it does not

There are no accounts and no custody. The app reads the chain; everything you do is signed in your own
wallet. Autopilot and Restake run on an [x/authz](https://docs.cosmos.network/main/build/modules/authz)
`StakeAuthorization` that permits **redelegation and staking only**: the grant cannot send, cannot unstake,
and is revocable in one click. Transaction fees for the automation are paid by us in PHOTON.

## Layout

- `bin/` - the site: templates, scripts, styles, and the render pipeline that bakes chain data into static
  pages (`render.py`, `collect.py`). The built tree is served as plain files behind nginx; there is no
  application server in front of users.
- `keeper/` - the automation behind Autopilot and Restake (public name: the pilot): planning, state, run
  reports, and its systemd units. It signs nothing itself.
- `vps/atomone-autopilot-signer/` - the small signer that holds the grantee key on a separate host and
  only signs the planned redelegations and restakes.
- `bot/` - the Telegram alert bot. `faucet/` - the testnet faucet. `dev/` under `bin/` - the test and
  audit harness (screenshot probes, clip and overflow audits, a flicker scan, smoke tests).

## Running it

The site is static once rendered: point the render at an AtomOne RPC/API pair, then serve `web/`.

```sh
python3 bin/collect.py && python3 bin/render.py    # bake data and pages into web/
cd web && python3 -m http.server 8089              # or any static server
```

The keeper, signer, bot and faucet each carry their systemd unit next to their code; all credentials come
from the environment or sealed files, never from this repo.

## Credit

Built and run by [GATA HUB](https://gatahub.zone), a community validator on AtomOne. The Nakamoto Bonus
mechanism itself is the work of the [AtomOne](https://atom.one) community.
