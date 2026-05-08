import { AdminShell } from "@/components/AdminShell"

export default function OficinaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell role="oficina">{children}</AdminShell>
}
