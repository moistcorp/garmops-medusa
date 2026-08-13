import type { INotificationProvider, ProviderSendNotificationDTO, ProviderSendNotificationResultsDTO } from "@medusajs/framework/types"
import { ModuleProvider, Modules } from "@medusajs/framework/utils"

export class ResendNotificationProvider implements INotificationProvider {
  static identifier = "resend"
  constructor(private readonly options: { apiKey?: string; from?: string } = {}) {}
  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    const apiKey = this.options.apiKey ?? process.env.RESEND_API_KEY
    const from = this.options.from ?? process.env.RESEND_FROM
    if (!apiKey || !from) throw new Error("Resend notification provider is not configured")
    if (notification.channel !== "email") throw new Error("Resend only supports email notifications")
    const content = notification.content as { subject?: string; html?: string; text?: string } | null | undefined
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" }, body: JSON.stringify({ from, to: notification.to, subject: content?.subject ?? notification.template, html: content?.html ?? "<p>" + notification.template + "</p>", text: content?.text }) })
    if (!response.ok) throw new Error("Resend returned " + response.status)
    const body = await response.json() as { id?: string }
    return { id: body.id }
  }
}

export default ModuleProvider(Modules.NOTIFICATION, { services: [ResendNotificationProvider] })
