import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/5 px-5 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
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

            <Link href="/plans" className="hover:text-white">
              Pricing
            </Link>

            <a href="#find-dj" className="hover:text-white">
              Find a DJ
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/5 pt-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md text-sm text-zinc-600">
            <p>
              Playing Next connects guests at an event with the DJ
              playing it, for paid song requests. Support:{" "}
              <a
                href="mailto:info@playingnextapp.com"
                className="text-zinc-400 hover:text-white"
              >
                info@playingnextapp.com
              </a>
            </p>

            <p className="mt-2">© {new Date().getFullYear()} Playing Next</p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-500">
            <Link href="/legal/privacy" className="hover:text-white">
              Privacy Policy
            </Link>

            <Link href="/legal/guest-terms" className="hover:text-white">
              Guest Terms
            </Link>

            <Link href="/legal/dj-terms" className="hover:text-white">
              DJ Terms
            </Link>

            <Link href="/legal/refund-policy" className="hover:text-white">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}