import { AdminShell } from "@/components/AdminShell"

export default function ModeradorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell role="moderador">{children}</AdminShell>
}
