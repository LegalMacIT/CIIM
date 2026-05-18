import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-8 py-0 flex items-stretch justify-between print:hidden">
        <div className="flex items-stretch gap-8">
          <span className="flex items-center text-base font-semibold tracking-tight text-gray-900 py-4">
            CIIM
          </span>
          <nav className="flex items-stretch gap-1">
            <Link
              href="/dashboard"
              className="flex items-center px-3 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent hover:border-gray-900 transition-colors"
            >
              Configuration
            </Link>
            <Link
              href="/manual"
              className="flex items-center px-3 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent hover:border-gray-900 transition-colors"
            >
              My Manual
            </Link>
          </nav>
        </div>
        <div className="flex items-center">
          <SignOutButton>
            <Button variant="ghost" size="sm" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Sign out
            </Button>
          </SignOutButton>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
