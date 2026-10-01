# AtomOne Autopilot signer - install on the signer VPS (mainnet)

Signs two jobs, both `MsgExec` on behalf of delegators who granted this address: moves
(`MsgBeginRedelegate`, inside a `StakeAuthorization REDELEGATE`) and restake
(`MsgWithdrawDelegatorReward` + `MsgDelegate`). It never sends anything. Before a restake
it reads the chain itself and refuses unless the delegator's rewards come back to the
delegator and what it stakes is no more than the rewards pending. It cannot move its own
coins.

Its own policy on top (audit 2026-09-30), read from its own RPC, whatever the keeper asks:
a move's destination must be bonded, not jailed and inside the keeper's window (ranks n-33 to
n-3 of the bonded set, `BOTTOM = 34`, `EDGE = 3` in both `server.mjs` and `keeper.py`), and the
delegator must hold at least the amount at each source; a restake stakes only on a bonded,
unjailed validator ranked n-3 or higher; at most 20 redelegations and delegations per delegator
in any 24 hours (in memory: a restart clears it); 30 requests a minute in all (429); a memo
over 64 characters or with control characters is refused; every tx is simulated first and
refused when gas x 1.4 passes `ATOMONE_MAX_GAS`, and carries a timeout height 100 blocks ahead.

Shares nothing with the payout signer (`gata-signer`, :8787):

| | payout signer | Autopilot signer |
|---|---|---|
| Linux user | `gata-signer` | `atomone-autopilot` |
| unit | `gata-signer` | `atomone-autopilot-signer` |
| code | `/srv/gata-signer/` | `/opt/atomone-autopilot-signer/` |
| key, secret, env | `/etc/gata/...` | `/etc/atomone-autopilot/` |
| port | 8787 | 8788 (WireGuard only) |

Libraries are pinned by `package-lock.json` (cosmjs 0.39: no `elliptic`, which 0.32 used).
Run as root on the VPS; the files arrive with `signer-pull` under
`/opt/signer-sync/dist/vps/atomone-autopilot-signer/`.

```bash
# 0. remove the first try under the old name, if present (it never held a key)
rm -rf /opt/gata-authz-signer

# 1. its own user, the code, the pinned libraries
useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin atomone-autopilot
SRC=/opt/signer-sync/dist/vps/atomone-autopilot-signer
install -d -o root -g atomone-autopilot -m 750 /opt/atomone-autopilot-signer
cp $SRC/{server.mjs,package.json,package-lock.json} /opt/atomone-autopilot-signer/
cd /opt/atomone-autopilot-signer && npm ci --omit=dev --ignore-scripts --no-audit --no-fund
chown -R root:atomone-autopilot /opt/atomone-autopilot-signer && chmod -R g+rX,o-rwx /opt/atomone-autopilot-signer
node --check server.mjs && echo CODE-OK

# 2. the key: paste the 24 words of the chosen address, Enter, then Ctrl-D
install -d -o root -g atomone-autopilot -m 750 /etc/atomone-autopilot
systemd-creds encrypt --name=autopilot_mnemonic - /etc/atomone-autopilot/mnemonic.cred
#    (no words yet? `sudo -u atomone-autopilot node /opt/atomone-autopilot-signer/server.mjs --keygen`
#     prints a fresh mnemonic and address once and stores nothing - write the words down offline)

# 3. the shared secret the keeper on the app box sends with every request
head -c 32 /dev/urandom | base64 | tr -d '/+=' | systemd-creds encrypt --name=autopilot_secret - /etc/atomone-autopilot/secret.cred
chmod 600 /etc/atomone-autopilot/*.cred
printf 'BIND=10.9.0.2\nPORT=8788\nATOMONE_RPC=https://atomone-rpc.gatadao.com,https://atomone-rpc.polkachu.com\n' > /etc/atomone-autopilot/signer.env
#    optional: ATOMONE_MAX_GAS=12000000 (the default; the gas limit after the 1.4 margin, 7 redelegations used 2.4M)
chown root:atomone-autopilot /etc/atomone-autopilot/signer.env && chmod 640 /etc/atomone-autopilot/signer.env

# 4. the unit, reachable only from the app box over WireGuard
cp $SRC/atomone-autopilot-signer.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now atomone-autopilot-signer
ufw allow from 10.9.0.1 to any port 8788 proto tcp comment 'atomone autopilot signer'
sleep 5; journalctl -u atomone-autopilot-signer -n 5 --no-pager   # expect: "signing as atone1..."

# 5. hand the secret to the app box ONCE (show it, copy it into the keeper env there, clear the screen)
systemd-creds decrypt --name=autopilot_secret /etc/atomone-autopilot/secret.cred -

# 6. fund the address it signs as with a little PHOTON (fees only; it never needs ATONE)
```

On the app box the keeper then gets `KEEPER_SECRET` (step 5) and `KEEPER_GRANTEE` once
`/whoami` over WireGuard returns the expected address.

Update the code later (after a `signer-pull`):

```bash
SRC=/opt/signer-sync/dist/vps/atomone-autopilot-signer
cp -p /opt/atomone-autopilot-signer/server.mjs /opt/atomone-autopilot-signer/server.mjs.prev   # the way back
cp $SRC/server.mjs /opt/atomone-autopilot-signer/ && node --check /opt/atomone-autopilot-signer/server.mjs
chown root:atomone-autopilot /opt/atomone-autopilot-signer/server.mjs && chmod 640 /opt/atomone-autopilot-signer/server.mjs
systemctl restart atomone-autopilot-signer && journalctl -u atomone-autopilot-signer -n 5 --no-pager
```

If `package-lock.json` changed too, re-run the `npm ci` line of step 1 first (the 2026-09-30 policy
update did not change it: cosmjs 0.39 already takes the timeout height). After the update the journal
logs every refusal as `exec granter=... refused: <why>` / `restake granter=... refused: <why>`; delete
the `.prev` copy once a 00:00 or 12:00 UTC run has gone through.

Environment (`signer.env`, all optional except on the testnet box): `BIND`, `PORT`, `ATOMONE_RPC`,
`CHAIN_ID` (default `atomone-1`), `ATOMONE_GAS_PRICE` (default `0.25uphoton`), `MAX_MOVES` (default 20, messages in one request), `MAX_MOVES_DAY` (default 60, per delegator in any 24 hours; keep it at the keeper's 60), `ATOMONE_MAX_GAS` (default
12000000).
Rotate the secret: re-run step 3's first line, restart, update the app box.
Retire it: `systemctl disable --now atomone-autopilot-signer`; every grant to its address goes inert.

Testnet does NOT run here: its signer runs on the app box with a separate testnet-only
account (`CHAIN_ID=atomone-testnet-1`).
