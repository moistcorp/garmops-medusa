import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import {
  AuditLog, CartProfile, CheckoutIdempotency, ConfiguredCartLine, DesignProject, DesignVersion, Invoice, InvoiceNumberCounter, NotificationEvent, OtpChallenge, OrderConfigurationSnapshot, OrderNumberCounter, PaymentAttempt, PaymentEvent, ProductionJob, ProductionStatusHistory, RefundRequest, StaffMember, StoredFile, TermsAcceptance,
} from "./models/models"
import { createHash, randomInt, timingSafeEqual } from "node:crypto"
import { ORDER_TRANSITIONS, type OrderStatus } from "../../domain/production"

class GarmopsModuleService extends MedusaService({ DesignProject, DesignVersion, ConfiguredCartLine, CartProfile, CheckoutIdempotency, OrderConfigurationSnapshot, StoredFile, ProductionJob, ProductionStatusHistory, RefundRequest, StaffMember, PaymentAttempt, PaymentEvent, Invoice, InvoiceNumberCounter, NotificationEvent, TermsAcceptance, AuditLog, OtpChallenge, OrderNumberCounter }) {
  updateOrderConfigurationSnapshots = async (): Promise<never> => {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Order configuration snapshots are immutable")
  }

  deleteOrderConfigurationSnapshots = async (): Promise<never> => {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Order configuration snapshots are immutable")
  }

  async createVersion(input: { projectId: string; configuration: Record<string, unknown>; productSlug: string; quantity: number; schemaVersion?: number; clientOperationId?: string }) {
    const versions = await this.listDesignVersions({ project_id: input.projectId }, { order: { revision: "DESC" } })
    const latest = versions[0]
    if (input.clientOperationId && latest?.client_operation_id === input.clientOperationId) return latest
    return this.createDesignVersions({ project_id: input.projectId, configuration: input.configuration, product_slug: input.productSlug, quantity: input.quantity, schema_version: input.schemaVersion ?? 1, revision: (latest?.revision ?? 0) + 1, client_operation_id: input.clientOperationId ?? null })
  }

  async duplicateProject(input: { projectId: string; ownerCustomerId: string; clientOperationId?: string }) {
    const source = await this.retrieveDesignProject(input.projectId)
    const versions = await this.listDesignVersions({ project_id: input.projectId }, { order: { revision: "DESC" }, take: 1 })
    const duplicate = await this.createDesignProjects({ owner_customer_id: input.ownerCustomerId, title: source.title + " Copy", product_slug: source.product_slug, active_version_id: null, source: "duplicate", archived: false, metadata: { duplicatedFrom: source.id, clientOperationId: input.clientOperationId ?? null } })
    if (versions[0]) {
      const version = await this.createVersion({ projectId: duplicate.id, productSlug: versions[0].product_slug, quantity: versions[0].quantity, configuration: versions[0].configuration })
      return this.updateDesignProjects({ id: duplicate.id, active_version_id: version.id })
    }
    return duplicate
  }

  async createImmutableSnapshot(input: { orderId: string; productSlug: string; quantity: number; sizeBreakdown: Record<string, number>; snapshot: Record<string, unknown>; pricingSnapshot: Record<string, unknown>; lineItemId?: string; lineNumber: number; customerId?: string; projectId?: string; versionId?: string }) {
    const immutableHash = createHash("sha256").update(JSON.stringify({ productSlug: input.productSlug, quantity: input.quantity, sizeBreakdown: input.sizeBreakdown, snapshot: input.snapshot, pricingSnapshot: input.pricingSnapshot })).digest("hex")
    return this.createOrderConfigurationSnapshots({ order_id: input.orderId, product_slug: input.productSlug, quantity: input.quantity, size_breakdown: input.sizeBreakdown, snapshot: input.snapshot, pricing_snapshot: input.pricingSnapshot, immutable_hash: immutableHash, line_item_id: input.lineItemId ?? null, line_number: input.lineNumber, customer_id: input.customerId ?? null, project_id: input.projectId ?? null, version_id: input.versionId ?? null })
  }

  async transitionProduction(input: { jobId: string; target: OrderStatus; actorId?: string; requestId?: string; reason?: string }) {
    const job = await this.retrieveProductionJob(input.jobId)
    const current = job.status as OrderStatus
    if (current === "on_hold") {
      if (!job.hold_from_status || input.target !== job.hold_from_status) throw new MedusaError(MedusaError.Types.CONFLICT, "A held job can only resume its previous status")
    } else if (!(ORDER_TRANSITIONS[current] ?? []).includes(input.target)) throw new MedusaError(MedusaError.Types.CONFLICT, `Invalid production transition: ${current} -> ${input.target}`)
    const updated = await this.updateProductionJobs({ id: input.jobId, status: input.target, hold_from_status: current === "on_hold" ? null : input.target === "on_hold" ? current : job.hold_from_status })
    await this.createProductionStatusHistories({ production_job_id: input.jobId, from_status: current, to_status: input.target, actor_id: input.actorId ?? null, request_id: input.requestId ?? null, reason: input.reason ?? null })
    return updated
  }

  async createOtp(email: string, requestId?: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const recent = await this.listOtpChallenges({ email: normalizedEmail }, { order: { created_at: "DESC" }, take: 10 })
    const windowStart = Date.now() - 10 * 60_000
    if (recent.filter((challenge) => new Date(challenge.created_at).getTime() >= windowStart).length >= 5) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Too many verification codes requested")
    const code = randomInt(100000, 1000000).toString()
    const challenge = await this.createOtpChallenges({ email: normalizedEmail, code_hash: createHash("sha256").update(code).digest("hex"), expires_at: new Date(Date.now() + 10 * 60_000), attempts: 0, consumed: false, request_id: requestId ?? null })
    return { challenge, code }
  }

  async consumeOtp(challengeId: string, code: string) {
    const challenge = await this.retrieveOtpChallenge(challengeId)
    if (challenge.consumed || new Date(challenge.expires_at).getTime() < Date.now() || challenge.attempts >= 5) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "The code is invalid or expired")
    const expected = Buffer.from(challenge.code_hash, "hex")
    const supplied = createHash("sha256").update(code).digest()
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      await this.updateOtpChallenges({ id: challenge.id, attempts: challenge.attempts + 1 })
      throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "The code is invalid or expired")
    }
    await this.updateOtpChallenges({ id: challenge.id, consumed: true })
    return challenge
  }

  async issueOrderNumber(orderType: "configured" | "sample", date = new Date()) {
    const year = date.getUTCFullYear()
    const key = `${orderType}:${year}`
    const counters = await this.listOrderNumberCounters({ counter_key: key })
    const counter = counters[0] ?? await this.createOrderNumberCounters({ counter_key: key, order_type: orderType, year, next_sequence: 1 })
    const sequence = counter.next_sequence
    await this.updateOrderNumberCounters({ id: counter.id, next_sequence: sequence + 1 })
    return `${orderType === "configured" ? "GAR" : "SAM"}-${year}-${String(sequence).padStart(6, "0")}`
  }

  async issueInvoiceNumber(date = new Date()) {
    const year = date.getUTCFullYear()
    const counters = await this.listInvoiceNumberCounters({ year })
    const counter = counters[0] ?? await this.createInvoiceNumberCounters({ year, next_sequence: 1 })
    const sequence = counter.next_sequence
    await this.updateInvoiceNumberCounters({ id: counter.id, next_sequence: sequence + 1 })
    return `INV-${year}-${String(sequence).padStart(6, "0")}`
  }

  async recordPaymentEvent(input: { providerEventId: string; providerTransactionId: string; paymentId?: string; paymentSessionId?: string; cartId?: string; orderId?: string; eventType: string; status: string; amountPaise?: number; eventPayloadHash: string }) {
    const existing = (await this.listPaymentEvents({ provider_transaction_id: input.providerTransactionId }))[0] ?? (await this.listPaymentEvents({ provider_event_id: input.providerEventId }))[0]
    if (existing) {
      if (existing.event_payload_hash !== input.eventPayloadHash || existing.event_type !== input.eventType || (input.paymentId && existing.payment_id !== input.paymentId)) await this.updatePaymentEvents({ id: existing.id, event_type: input.eventType, event_payload_hash: input.eventPayloadHash, payment_id: input.paymentId ?? existing.payment_id })
      return { event: existing, duplicate: true }
    }
    try {
      const event = await this.createPaymentEvents({ provider: "payu", provider_event_id: input.providerEventId, provider_transaction_id: input.providerTransactionId, payment_id: input.paymentId ?? null, payment_session_id: input.paymentSessionId ?? null, cart_id: input.cartId ?? null, order_id: input.orderId ?? null, event_type: input.eventType, status: input.status, amount_paise: input.amountPaise ?? null, payload_hash: null, event_payload_hash: input.eventPayloadHash, processed_at: null, last_error: null })
      return { event, duplicate: false }
    } catch (error) {
      // Two callback/webhook deliveries can pass the read-before-create check
      // concurrently. Unique constraints are the final idempotency boundary.
      const concurrent = (await this.listPaymentEvents({ provider_transaction_id: input.providerTransactionId }))[0] ?? (await this.listPaymentEvents({ provider_event_id: input.providerEventId }))[0]
      if (concurrent) return { event: concurrent, duplicate: true }
      throw error
    }
  }

  async markPaymentEvent(input: { id: string; status: string; orderId?: string; error?: string }) {
    return this.updatePaymentEvents({ id: input.id, status: input.status, order_id: input.orderId ?? null, last_error: input.error ?? null, processed_at: input.status === "completed" ? new Date() : null })
  }

  async invalidatePaymentAttempt(input: { id: string; reason?: string }) {
    const attempt = await this.retrievePaymentAttempt(input.id)
    if (["invalidated", "completed", "failed", "expired", "reconciliation_required"].includes(attempt.status)) return attempt
    return this.updatePaymentAttempts({ id: attempt.id, status: "invalidated", invalidated_at: new Date(), last_error: input.reason ?? null })
  }
}

export default GarmopsModuleService
