# GATA authz signer - install on the signer VPS

Its own key, its own secret, its own unit and port (8788, WireGuard only). It signs
one message type: `MsgExec` wrapping `MsgBeginRedelegate`, on behalf of delegators who
granted this address a `StakeAuthorization REDELEGATE`. It cannot move its own coins.

Run as root on the VPS after the next `signer-pull` (the files arrive under
`/opt/signer-sync/dist/vps/authz-signer/`).

```bash
# 1. code + deps
install -d -o gata-signer -g gata-signer -m 750 /opt/gata-authz-signer
cp /opt/signer-sync/dist/vps/authz-signer/{server.mjs,package.json} /opt/gata-authz-signer/
chown -R gata-signer:gata-signer /opt/gata-authz-signer
cd /opt/gata-authz-signer && sudo -u gata-signer npm install --omit=dev --no-audit --no-fund

# 2. a fresh key for this signer alone (prints the 24 words once - keep them off this box too)
sudo -u gata-signer node /opt/gata-authz-signer/server.mjs --keygen

# 3. seal the mnemonic and a fresh shared secret as systemd credentials (paste, then Ctrl-D)
systemd-creds encrypt --name=authz_mnemonic - /etc/gata/authz_mnemonic.cred
head -c 32 /dev/urandom | base64 | tr -d '/+=' | systemd-creds encrypt --name=authz_secret - /etc/gata/authz_secret.cred
chmod 600 /etc/gata/authz_mnemonic.cred /etc/gata/authz_secret.cred
#    (write the same secret into /etc/gata/atomone-app-keeper.env on the app box as KEEPER_SECRET)
printf 'BIND=10.9.0.2\nPORT=8788\nATOMONE_RPC=https://atomone-rpc.gatadao.com,https://atomone-rpc.polkachu.com\n' > /etc/gata/authz-signer.env
chown root:gata-signer /etc/gata/authz-signer.env && chmod 640 /etc/gata/authz-signer.env

# 4. the unit, reachable only from the app box over WireGuard
cp /opt/signer-sync/dist/vps/authz-signer/gata-authz-signer.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now gata-authz-signer
ufw allow from 10.9.0.1 to any port 8788 proto tcp comment 'gata authz signer'
journalctl -u gata-authz-signer -n 5 --no-pager        # expect: "signing as atone1..."

# 5. fund the address it printed with a little PHOTON (fees only; it never needs ATONE)
```

Rotate the secret: re-run the `authz_secret` line, restart the unit, update the app box.
Retire it: `systemctl disable --now gata-authz-signer`; every grant to its address goes inert.
