# Unit proposals (red team 2026-10-01)

Proposed, NOT installed. Each file goes to /etc/systemd/system; nothing here is read at runtime.

| File here | Installs as | What it changes |
|---|---|---|
| atomone-app-admin.service | /etc/systemd/system/atomone-app-admin.service | RW only on /srv/atomone-app/state/admin (was the whole state dir), ADMIN_STATE_DIR set, MemoryMax=256M |
| atomone-app-bot.service.d/redteam.conf | /etc/systemd/system/atomone-app-bot.service.d/redteam.conf | bot.py and its __pycache__ read only inside the bot's RW dir; state/admin read only |
| atomone-app-live.service.d/redteam.conf | /etc/systemd/system/atomone-app-live.service.d/redteam.conf | live.json written to /srv/atomone-app/live/mainnet, RW only there (was the whole web root) |
| atomone-app-live-testnet.service.d/redteam.conf | /etc/systemd/system/atomone-app-live-testnet.service.d/redteam.conf | the same for /srv/atomone-app/live/testnet |
| admin-ro.conf | /etc/systemd/system/<unit>.service.d/admin-ro.conf for atomone-app-build, atomone-app-dev-build, atomone-app-grantwatch, atomone-app-grantwatch-testnet, atomone-app-valwatch | state/admin read only for every other unit with RW on the state dir |

Why: every app unit runs as atomone-app, so file modes cannot keep one unit out of another's files; only the
systemd sandbox can. A ReadOnlyPaths= inside a ReadWritePaths= is a read-only bind mount: no write, no unlink,
no rename over it (checked with a transient unit). The leading "-" lets a unit start before the path exists.

Prerequisites, in this order (as root):

    install -d -m 700 -o atomone-app -g atomone-app /srv/atomone-app/state/admin
    install -d -m 2750 -o atomone-app -g www-data /srv/atomone-app/live /srv/atomone-app/live/mainnet /srv/atomone-app/live/testnet

Then install the files, `systemctl daemon-reload`, and restart the units concerned. The full deploy order is in the
red team report: the admin state is copied first, and web/live.json becomes a symlink only once live writes to
the new dir.
