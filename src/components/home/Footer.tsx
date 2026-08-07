import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/5 px-5 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="Playing Next"
            className="h-9 w-9"
          />

          <div>
            <p className="font-bold">Playing Next</p>

            <p className="mt-1 text-sm text-zinc-600">
              The modern request platform for DJs.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-500">
          <Link href="/login" className="hover:text-white">
            Log in
          </Link>

          <Link href="/signup" className="hover:text-white">
            Sign up
          </Link>

          <a href="#find-dj" className="hover:text-white">
            Find a DJ
          </a>

          <span>
            © {new Date().getFullYear()} Playing Next
          </span>
        </div>
      </div>
    </footer>
  );
}