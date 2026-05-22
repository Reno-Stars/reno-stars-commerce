"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition, type FormEvent } from "react"

// Inline magnifier SVG — avoids adding a lucide-react dependency for one icon.
const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

/**
 * Header search input — submits to `/${countryCode}/store?q=...` which
 * forwards the query to Medusa's `/store/products?q=` (built-in title
 * /description fulltext search; no external Algolia/Meili provider
 * needed for the 1700-product catalog).
 *
 * Country code resolves from the current pathname's first segment
 * (`/ca/...` → `ca`). Falls back to `ca` if the path is somehow empty
 * — Reno Stars only sells in Canada so far, so this is safe.
 */
export default function SearchBox() {
  const router = useRouter()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get("q") ?? "")
  const [pending, startTransition] = useTransition()

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = q.trim()
    // Derive country code from current URL — avoids hard-coding "ca"
    // and keeps the nav portable if Reno Stars adds more regions.
    const cc =
      typeof window !== "undefined"
        ? window.location.pathname.split("/").filter(Boolean)[0] || "ca"
        : "ca"
    const target = trimmed
      ? `/${cc}/store?q=${encodeURIComponent(trimmed)}`
      : `/${cc}/store`
    startTransition(() => router.push(target))
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search materials, faucets, vanities…"
        aria-label="Search products"
        className="bg-white/60 text-reno-navy placeholder:text-reno-navy/40 px-4 py-2 rounded-full pr-10 border border-reno-navy/10 hidden small:inline-block focus:bg-white focus:border-reno-navy/30 outline-none transition-colors disabled:opacity-50"
        disabled={pending}
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-reno-navy/50 hover:text-reno-navy p-1 rounded-full"
        aria-label="Submit search"
        title="Submit search"
        disabled={pending}
      >
        <SearchIcon />
      </button>
    </form>
  )
}
