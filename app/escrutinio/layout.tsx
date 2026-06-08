import { AdminShell } from "@/components/AdminShell"

export default function EscrutinioLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell role="escrutinio">{children}</AdminShell>
}
