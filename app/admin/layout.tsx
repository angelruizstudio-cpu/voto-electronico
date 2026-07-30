import { AdminShell } from "@/components/AdminShell"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell role="admin">{children}</AdminShell>
}
