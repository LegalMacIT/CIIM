import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import "@/app/(customer)/manual/ciim-manual.css";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const role = (user.publicMetadata as { role?: string })?.role;
  if (role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-8 py-0 flex items-stretch justify-between">
        <div className="flex items-stretch gap-8">
          <span className="flex items-center text-base font-semibold tracking-tight text-gray-900 py-4">
            CIIM Admin
          </span>
          <nav className="flex items-stretch gap-1">
            <Link
              href="/admin"
              className="flex items-center px-3 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent hover:border-gray-900 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/customers"
              className="flex items-center px-3 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent hover:border-gray-900 transition-colors"
            >
              Clients
            </Link>
            <Link
              href="/admin/template"
              className="flex items-center px-3 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent hover:border-gray-900 transition-colors"
            >
              Template
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
