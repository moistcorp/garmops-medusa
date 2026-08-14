import type { ExecArgs } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { stdin as input } from "node:process"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"

function args() {
  const values = new Map<string, string>()
  for (let index = 2; index < process.argv.length; index += 1) {
    const key = process.argv[index]
    if (key?.startsWith("--")) {
      const next = process.argv[index + 1]
      values.set(key.slice(2), next && !next.startsWith("--") ? next : "true")
      if (next && !next.startsWith("--")) index += 1
    }
  }
  return values
}

function validEmail(value: string) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) }

export default async function createStaff({ container }: ExecArgs) {
  const values = args()
  const email = (values.get("email") ?? "").trim().toLowerCase()
  const role = values.get("role") ?? ""
  const displayName = (values.get("display-name") ?? email.split("@")[0] ?? "").trim()
  if (!validEmail(email) || !["founder", "operations"].includes(role) || !displayName) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Usage: npm run staff:create -- --email person@example.com --role founder|operations --display-name Name")
  const customerService = container.resolve(Modules.CUSTOMER)
  if ((await customerService.listCustomers({ email })).length) throw new MedusaError(MedusaError.Types.CONFLICT, "Refusing staff/customer email collision")
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  if ((await service.listStaffMembers({ email })).length) throw new MedusaError(MedusaError.Types.CONFLICT, "Staff account already exists")
  const password = await readPassword(values.get("password-stdin") === "true")
  if (password.length < 12) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Staff password must be at least 12 characters")
  const authService = container.resolve(Modules.AUTH)
  const registered = await authService.register("emailpass", { body: { email, password } })
  if (!registered.success || !registered.authIdentity) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, registered.error || "Could not create staff authentication identity")
  const { result: user } = await createUserAccountWorkflow(container).run({ input: { authIdentityId: registered.authIdentity.id, userData: { email, first_name: displayName } } })
  const staff = await service.createStaffMembers({ email, auth_user_id: user.id, display_name: displayName, role: role as "founder" | "operations", active: true, provisioned_by: null, metadata: { authProvider: "emailpass" } })
  console.log(`Staff account created: ${staff.email} (${staff.role}). Login with POST /auth/user/emailpass.`)
}

async function readPassword(fromStdin: boolean) {
  if (fromStdin) {
    const chunks: Buffer[] = []
    for await (const chunk of input) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks).toString("utf8").trim()
  }
  throw new MedusaError(MedusaError.Types.INVALID_DATA, "Provide --password-stdin; passwords are never accepted as command-line arguments")
}
