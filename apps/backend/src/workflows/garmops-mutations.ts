import { Modules, MedusaError } from "@medusajs/framework/utils"
import type { ILockingModule } from "@medusajs/framework/types"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { GARMOPS_MODULE } from "../modules/garmops"
import type GarmopsModuleService from "../modules/garmops/service"
import { approveStoredFile } from "../services/file-scan"
import { aggregateArtworkReviewStatus, requiredArtworkFileIds, type ArtworkReviewStatus } from "../domain/artwork"

type Container = { resolve<T>(key: string): T }

const createDesignStep = createStep("create-design", async (input: { customerId: string; title: string; productSlug: string; configuration: Record<string, unknown>; quantity: number; clientOperationId?: string }, { container }) => {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const project = await service.createDesignProjects({ owner_customer_id: input.customerId, title: input.title, product_slug: input.productSlug, active_version_id: null, source: "configurator", archived: false, metadata: null })
  const version = await service.createVersion({ projectId: project.id, productSlug: input.productSlug, configuration: input.configuration, quantity: input.quantity, clientOperationId: input.clientOperationId })
  const saved = await service.updateDesignProjects({ id: project.id, active_version_id: version.id })
  return new StepResponse({ project: saved, version }, project.id)
}, async (projectId, { container }) => {
  if (projectId) await container.resolve<GarmopsModuleService>(GARMOPS_MODULE).deleteDesignProjects(projectId)
})

export const createGarmopsDesignWorkflow = createWorkflow("create-garmops-design", (input: Parameters<typeof createDesignStep>[0]) => new WorkflowResponse(createDesignStep(input)))

const updateDesignStep = createStep("update-design", async (input: { projectId: string; productSlug: string; configuration: Record<string, unknown>; quantity: number; expectedRevision: number; clientOperationId: string }, { container }) => {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const locking = container.resolve<ILockingModule>(Modules.LOCKING)
  const result = await locking.execute(`design:${input.projectId}`, async () => {
    const version = await service.createVersion({ projectId: input.projectId, productSlug: input.productSlug, configuration: input.configuration, quantity: input.quantity, expectedRevision: input.expectedRevision, clientOperationId: input.clientOperationId })
    const project = await service.updateDesignProjects({ id: input.projectId, active_version_id: version.id })
    return { project, version }
  }, { timeout: 30 })
  return new StepResponse(result)
})

export const updateGarmopsDesignWorkflow = createWorkflow("update-garmops-design", (input: Parameters<typeof updateDesignStep>[0]) => new WorkflowResponse(updateDesignStep(input)))

const createCartProfileStep = createStep("create-cart-profile", async (input: { cartId: string; cartType: "configured" | "sample"; customerId?: string }, { container }) => {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const profile = await service.createCartProfiles({ cart_id: input.cartId, cart_type: input.cartType, customer_id: input.customerId ?? null })
  return new StepResponse(profile, profile.id)
}, async (profileId, { container }) => {
  if (profileId) await container.resolve<GarmopsModuleService>(GARMOPS_MODULE).deleteCartProfiles(profileId)
})

export const createGarmopsCartProfileWorkflow = createWorkflow("create-garmops-cart-profile", (input: Parameters<typeof createCartProfileStep>[0]) => new WorkflowResponse(createCartProfileStep(input)))

type StoredFileInput = Record<string, unknown> & { id: string }
const createStoredFileStep = createStep("create-stored-file", async (input: StoredFileInput, { container }) => {
  const file = await container.resolve<GarmopsModuleService>(GARMOPS_MODULE).createStoredFiles(input as never)
  return new StepResponse(file, file.id)
}, async (fileId, { container }) => {
  if (fileId) await container.resolve<GarmopsModuleService>(GARMOPS_MODULE).deleteStoredFiles(fileId)
})

export const createGarmopsStoredFileWorkflow = createWorkflow("create-garmops-stored-file", (input: StoredFileInput) => new WorkflowResponse(createStoredFileStep(input)))

const verifyOtpStep = createStep("verify-otp", async (input: { challengeId: string; code: string }, { container }) => {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const locking = container.resolve<ILockingModule>(Modules.LOCKING)
  const challenge = await locking.execute(`otp-challenge:${input.challengeId}`, () => service.consumeOtp(input.challengeId, input.code), { timeout: 30 })
  const customerService = container.resolve<any>(Modules.CUSTOMER)
  const customer = (await customerService.listCustomers({ email: challenge.email }))[0] ?? await customerService.createCustomers({ email: challenge.email, metadata: { authSource: "email_otp" } })
  return new StepResponse(customer)
})

export const verifyGarmopsOtpWorkflow = createWorkflow("verify-garmops-otp", (input: Parameters<typeof verifyOtpStep>[0]) => new WorkflowResponse(verifyOtpStep(input)))

const reviewArtworkStep = createStep("review-artwork", async (input: { fileId: string; decision: "approve" | "reject"; actorId: string; requestId?: string; productionJobId?: string }, { container }) => {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const job = input.productionJobId ? await service.retrieveProductionJob(input.productionJobId) : null
  if (job && input.decision === "approve" && !["payment_confirmed", "order_review", "artwork_pending"].includes(job.status)) throw new MedusaError(MedusaError.Types.CONFLICT, "Artwork cannot be approved at the current production stage")
  const file = input.decision === "approve"
    ? await approveStoredFile(container, input.fileId)
    : await service.updateStoredFiles({ id: input.fileId, state: "rejected", metadata: { reviewStatus: "rejected", reviewedAt: new Date().toISOString() } })
  await service.createAuditLogs({ actor_type: "staff", actor_id: input.actorId, action: `artwork_${input.decision}`, resource_type: "order_artwork", resource_id: job ? `${job.order_id}:${input.fileId}` : input.fileId, request_id: input.requestId ?? null, before_snapshot: null, after_snapshot: { orderId: job?.order_id ?? null, fileId: input.fileId, decision: input.decision, reviewStatus: input.decision === "approve" ? "approved" : "rejected" }, metadata: null })
  if (job) {
    const snapshots = await service.listOrderConfigurationSnapshots({ order_id: job.order_id })
    const requiredFileIds = requiredArtworkFileIds(snapshots)
    const reviewStatuses: ArtworkReviewStatus[] = []
    for (const requiredFileId of requiredFileIds) {
      const requiredFile = await service.retrieveStoredFile(requiredFileId)
      const status = (requiredFile.metadata as Record<string, unknown> | null)?.reviewStatus
      reviewStatuses.push(status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending")
    }
    const aggregate = aggregateArtworkReviewStatus(reviewStatuses)
    if (input.decision === "approve") {
      if (aggregate === "approved" && requiredFileIds.length > 0) {
        await service.updateProductionJobs({ id: job.id, status: "artwork_approved", artwork_review_status: "approved" })
        await service.createProductionStatusHistories({ production_job_id: job.id, from_status: job.status, to_status: "artwork_approved", actor_id: input.actorId, request_id: input.requestId ?? null, reason: "All frozen artwork files approved" })
      } else await service.updateProductionJobs({ id: job.id, artwork_review_status: aggregate })
    } else {
      await service.updateProductionJobs({ id: job.id, artwork_review_status: aggregate === "approved" ? "pending" : aggregate })
    }
  }
  return new StepResponse(file)
})

export const reviewGarmopsArtworkWorkflow = createWorkflow("review-garmops-artwork", (input: Parameters<typeof reviewArtworkStep>[0]) => new WorkflowResponse(reviewArtworkStep(input)))

const setTrackingStep = createStep("set-tracking", async (input: { jobId: string; trackingNumber: string; trackingUrl?: string | null; actorId: string; requestId?: string }, { container }) => {
  const service = container.resolve<GarmopsModuleService>(GARMOPS_MODULE)
  const job = await service.retrieveProductionJob(input.jobId)
  const updated = await service.updateProductionJobs({ id: job.id, tracking_number: input.trackingNumber, tracking_url: input.trackingUrl ?? null })
  await service.createAuditLogs({ actor_type: "staff", actor_id: input.actorId, action: "tracking_updated", resource_type: "production_job", resource_id: job.id, request_id: input.requestId ?? null, before_snapshot: { trackingNumber: job.tracking_number, trackingUrl: job.tracking_url }, after_snapshot: { trackingNumber: input.trackingNumber, trackingUrl: input.trackingUrl ?? null }, metadata: null })
  return new StepResponse(updated)
})

export const setGarmopsTrackingWorkflow = createWorkflow("set-garmops-tracking", (input: Parameters<typeof setTrackingStep>[0]) => new WorkflowResponse(setTrackingStep(input)))

export function isWorkflowConflict(error: unknown): boolean {
  return error instanceof MedusaError && [MedusaError.Types.CONFLICT, MedusaError.Types.DUPLICATE_ERROR].includes(error.type)
}

export type GarmopsMutationContainer = Container
