import Link from "next/link";

export default function Navbar() {
  return (
    <header className="relative z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="Playing Next"
            className="h-10 w-10"
          />

          <span className="text-base font-bold tracking-tight sm:text-lg">
            Playing Next
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-400 lg:flex">
          <a href="#find-dj" className="transition hover:text-white">
            Search DJs
          </a>

          <a href="#features" className="transition hover:text-white">
            Features
          </a>

          <a href="#how-it-works" className="transition hover:text-white">
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:text-white sm:inline-flex"
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className="rounded-full bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-zinc-200 sm:px-5"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}