import type { INotificationProvider, ProviderSendNotificationDTO, ProviderSendNotificationResultsDTO } from "@medusajs/framework/types"
import { MedusaError, ModuleProvider, Modules } from "@medusajs/framework/utils"
import { testState } from "../../integrations/test-doubles"
import { injectTestFailure } from "../../integrations/test-failures"

export class ResendNotificationProvider implements INotificationProvider {
  static identifier = "resend"
  constructor(private readonly options: { apiKey?: string; from?: string } = {}) {}
  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    if (process.env.GARMOPS_TEST_DOUBLES === "true") {
      injectTestFailure("resend")
      testState().notifications.push({ ...notification as unknown as Record<string, unknown>, sentAt: new Date().toISOString() })
      return { id: `test-notification-${testState().notifications.length}` }
    }
    const apiKey = this.options.apiKey ?? process.env.RESEND_API_KEY
    const from = this.options.from ?? process.env.RESEND_FROM
    if (!apiKey || !from) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Resend notification provider is not configured")
    if (notification.channel !== "email") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Resend only supports email notifications")
    const content = notification.content as { subject?: string; html?: string; text?: string } | null | undefined
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" }, body: JSON.stringify({ from, to: notification.to, subject: content?.subject ?? notification.template, html: content?.html ?? "<p>" + notification.template + "</p>", text: content?.text }) })
    if (!response.ok) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Resend returned " + response.status)
    const body = await response.json() as { id?: string }
    return { id: body.id }
  }
}

export default ModuleProvider(Modules.NOTIFICATION, { services: [ResendNotificationProvider] })
