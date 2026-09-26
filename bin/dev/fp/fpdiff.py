#!/usr/bin/env python3
"""fpdiff.py A.txt B.txt [A2.txt ...] -- states whose fingerprint differs.

With more than one A run (A.txt,A2.txt passed as "A.txt,A2.txt"), a state passes when B matches
any A run: the page itself can differ run to run under load (timers against fetches), and a real
difference never matches."""
import sys
def states(f):
    out, sig, L, i, mode = {}, {}, open(f).read().split("\n"), 0, ""
    while i < len(L):
        l = L[i]
        if l.startswith("#STATE"):
            out[l.split()[1]] = (l.split()[3], dict(x.split(":") for x in L[i + 1].split())); i += 2; continue
        if l.startswith("#SIGS"): mode = "g"; i += 1; continue
        if mode == "g" and l.strip(): k, _, v = l.partition(" "); sig[k] = v
        i += 1
    return out, sig
A = [states(f) for f in sys.argv[1].split(",")]; B = [states(f) for f in sys.argv[2].split(",")]
bad = []
for s, (h, _) in A[0][0].items():
    if not any(b[0].get(s, ("",))[0] == a[0].get(s, ("",))[0] for a in A for b in B): bad.append(s)
print("states:", len(A[0][0]), "differ:", bad or "none")
for s in bad[:3]:
    a, b = A[0][0][s][1], B[0][0].get(s, ("", {}))[1]
    ks = [k for k in a if a[k] != b.get(k)]
    print(" ", s, len(ks), "elements, e.g.:"); [print("    ", A[0][1].get(k, k)[:150]) for k in ks[:5]]
sys.exit(1 if bad else 0)
