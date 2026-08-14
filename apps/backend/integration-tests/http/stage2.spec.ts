import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createApiKeysWorkflow, createUserAccountWorkflow } from "@medusajs/core-flows"
import { createHash } from "node:crypto"
import path from "node:path"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { GARMOPS_MODULE } from "../../src/modules/garmops"

jest.setTimeout(120_000)

// The official runner creates this database before booting Medusa. Setting the
// URL explicitly prevents the repository's developer .env from ever being
// selected by a test process.
const testDatabaseName = `medusa-garmops-stage2-integration-${process.env.JEST_WORKER_ID ?? "1"}`
process.env.DATABASE_URL = `postgres://garmops_test:garmops_test_only@${process.env.DB_HOST ?? "localhost"}:${process.env.DB_PORT ?? "55432"}/${testDatabaseName}`
const backendCwd = path.resolve(__dirname, "../..")
const compiledCwd = path.join(backendCwd, ".medusa/server")

medusaIntegrationTestRunner({
  moduleName: "garmops-stage2",
  cwd: compiledCwd,
  medusaConfigFile: compiledCwd,
  hooks: {
    beforeServerStart: async (container) => {
      // The monorepo's compiled Medusa loader can register a PG connection
      // while discovering modules. Let the official runner initialize its
      // isolated connection instead of reusing that pre-discovery instance.
      const pgKey = ContainerRegistrationKeys.PG_CONNECTION
      if (container.hasRegistration(pgKey)) delete (container as any).registrations?.[pgKey]
    },
  },
  env: {
    NODE_ENV: "test",
    GARMOPS_TEST_DOUBLES: "true",
    EXPOSE_TEST_OTP: "true",
    PAYU_ENV: "test",
    PAYU_KEY: process.env.PAYU_KEY ?? "stage2-test-key",
    PAYU_SALT: process.env.PAYU_SALT ?? "stage2-test-salt",
    R2_PRIVATE_BUCKET: "garmops-e2e-private",
    R2_PUBLIC_BUCKET: "garmops-e2e-public",
  },
  testSuite: ({ api, getContainer }) => {
    describe("Stage 2 backend HTTP integration", () => {
      beforeAll(async () => {
        const { result } = await createApiKeysWorkflow(getContainer()).run({
          input: {
            api_keys: [{ type: "publishable", title: "Stage 2 integration", created_by: "stage2-test" }],
          },
        })
        api.defaults.headers.common["x-publishable-api-key"] = result[0].token
        api.defaults.validateStatus = (status) => status < 500
      })

      beforeEach(() => {
        process.env.GARMOPS_TEST_DOUBLES = "true"
      })

      async function customer(email: string) {
        const requested = await api.post("/store/garmops/otp/request", { email })
        const authenticated = await api.post("/auth/customer/emailotp", { email, challengeId: requested.data.challengeId, code: requested.data.testCode })
        expect(authenticated.status).toBe(200)
        return { Authorization: `Bearer ${authenticated.data.token}` }
      }

      async function staff(role: "founder" | "operations") {
        const email = `stage2-${role}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`
        const password = "stage2-test-password-1234"
        const container = getContainer()
        const auth = container.resolve<any>(Modules.AUTH)
        const registered = await auth.register("emailpass", { body: { email, password } })
        expect(registered.success).toBe(true)
        const { result: user } = await createUserAccountWorkflow(container).run({ input: { authIdentityId: registered.authIdentity.id, userData: { email, first_name: role } } })
        const garmops = container.resolve<any>(GARMOPS_MODULE)
        const created = await garmops.createStaffMembers({ email, auth_user_id: user.id, display_name: role, role, active: true, provisioned_by: null, metadata: { authProvider: "emailpass" } })
        expect(created.role).toBe(role)
        const authenticated = await api.post("/auth/user/emailpass", { email, password })
        expect(authenticated.status).toBe(200)
        expect(authenticated.data.token).toEqual(expect.any(String))
        return { Authorization: `Bearer ${authenticated.data.token}` }
      }

      function payuResponse(paymentSession: any, cartId: string, status = "success") {
        const sessionData = paymentSession.data ?? {}
        const fields = sessionData.fields ?? sessionData
        const response = { key: fields.key, txnid: fields.txnid, amount: fields.amount, productinfo: fields.productinfo, firstname: fields.firstname, email: fields.email, udf1: fields.udf1 ?? cartId, udf5: fields.udf5, status, mihpayid: `mih-${Date.now()}-${Math.random().toString(16).slice(2)}` }
        const responseParts = [process.env.PAYU_SALT ?? "stage2-test-salt", response.status, "", "", "", "", "", response.udf5 ?? "", "", "", "", response.udf1 ?? "", response.email, response.firstname, response.productinfo, response.amount, response.txnid, response.key]
        return { ...response, hash: createHash("sha512").update(responseParts.join("|")).digest("hex") }
      }

      async function paidCart(headers: Record<string, string>, cartType: "configured" | "sample") {
        const email = `paid-${cartType}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`
        const cart = await api.post("/store/garmops/cart", { cartType, email }, { headers })
        expect(cart.status).toBe(201)
        const cartId = cart.data.cart.cartId
        if (cartType === "configured") {
          const design = await api.post("/store/garmops/designs", { title: "E2E Foundry order", productSlug: "regular-fit-tee-200gsm", quantity: 50, configuration: { colourType: "signature", artwork: {}, neckLabel: { labelType: "standard-size" }, deliveryType: "standard" } }, { headers })
          expect(design.status).toBe(201)
          const line = await api.post("/store/garmops/cart-lines", { cartId, projectId: design.data.project.id, versionId: design.data.version.id, quantity: 50, sizes: { S: 10, M: 20, L: 20 } }, { headers })
          expect(line.status).toBe(201)
        } else {
          const line = await api.post("/store/garmops/sample-cart", { cartId, productSlug: "regular-fit-tee-200gsm", size: "M", quantity: 2 }, { headers })
          expect(line.status).toBe(201)
        }
        const checkout = await api.post("/store/garmops/checkout/prepare", { cartId, email, termsVersion: "terms-2026-08", privacyVersion: "privacy-2026-08", shippingAddress: { first_name: "E2E", last_name: "Customer", address_1: "1 Test Street", city: "Bengaluru", province: "Karnataka", postal_code: "560001", country_code: "in", phone: "9999999999" } }, { headers })
        expect(checkout.status).toBe(200)
        const initiated = await api.post("/store/garmops/payments/payu/initiate", { cartId }, { headers })
        expect(initiated.status).toBe(201)
        const response = payuResponse(initiated.data.paymentSession, cartId)
        const callback = await api.post("/store/garmops/payments/payu/callback", response)
        expect([200, 202]).toContain(callback.status)
        return { cartId, order: callback.data.orderId, paymentSession: initiated.data.paymentSession }
      }

      it("serves the canonical catalogue and rejects per-line MOQ bypasses", async () => {
        const catalog = await api.get("/store/garmops/catalog")
        expect(catalog.status).toBe(200)
        expect(catalog.data.products).toHaveLength(10)
        expect(catalog.data.products.map((product: { slug: string }) => product.slug)).toContain("regular-fit-tee-200gsm")

        const rejected = await api.post("/store/garmops/pricing", {
          productSlug: "regular-fit-tee-200gsm",
          quantity: 10,
          sizes: { S: 10 },
          allowedSizes: ["XS", "S", "M", "L", "XL"],
          colourType: "signature",
        })
        expect(rejected.status).toBe(400)
        expect(rejected.data.code).toBe("INVALID_CONFIGURATION")

        const valid = await api.post("/store/garmops/pricing", {
          productSlug: "regular-fit-tee-200gsm",
          quantity: 50,
          sizes: { XS: 5, S: 10, M: 15, L: 10, XL: 10 },
          allowedSizes: ["XS", "S", "M", "L", "XL"],
          colourType: "signature",
          artwork: { front: { fileId: "fixture-artwork", technique: "screen_print" } },
        })
        expect(valid.status).toBe(200)
        expect(valid.data.pricing.quantity).toBe(50)
        expect(valid.data.pricing.totalPaise).toBeGreaterThan(valid.data.pricing.subtotalPaise)
      })

      it("authenticates an OTP customer without exposing secrets", async () => {
        const email = `stage2-${Date.now()}@example.test`
        const requested = await api.post("/store/garmops/otp/request", { email })
        expect(requested.status).toBe(202)
        expect(requested.data.challengeId).toBeTruthy()
        expect(requested.data.testCode).toMatch(/^\d{6}$/)

        const authenticated = await api.post("/auth/customer/emailotp", {
          email,
          challengeId: requested.data.challengeId,
          code: requested.data.testCode,
        })
        expect(authenticated.status).toBe(200)
        expect(authenticated.data.token).toEqual(expect.any(String))
        expect(JSON.stringify(authenticated.data)).not.toContain(requested.data.testCode)

        const customerService = getContainer().resolve<any>("customer")
        const customers = await customerService.listCustomers({ email })
        expect(customers).toHaveLength(1)
        expect(customers[0].metadata.authSource).toBe("email_otp")
      })

      it("keeps test adapter boundaries deterministic", async () => {
        const { testPutObject, testObjectSha256, resetTestState, testState } = await import(path.join(compiledCwd, "src/integrations/test-doubles.js"))
        resetTestState()
        const body = new TextEncoder().encode("safe artwork fixture")
        testPutObject({ key: "fixture/artwork.svg", body, contentType: "image/svg+xml" })
        expect(testObjectSha256("fixture/artwork.svg")).toBe(createHash("sha256").update(body).digest("hex"))
        expect(testState().notifications).toHaveLength(0)
        expect(testState().paymentCommands).toHaveLength(0)
      })

      it("executes configured and sample cart APIs with per-line MOQ and ownership enforcement", async () => {
        const customerA = await customer(`cart-a-${Date.now()}@example.test`)
        const designA = await api.post("/store/garmops/designs", { title: "Cart A", productSlug: "regular-fit-tee-200gsm", quantity: 50, configuration: { colourType: "signature", artwork: {}, neckLabel: { labelType: "standard-size" }, deliveryType: "standard" } }, { headers: customerA })
        expect(designA.status).toBe(201)
        const cart = await api.post("/store/garmops/cart", { cartType: "configured" }, { headers: customerA })
        expect(cart.status).toBe(201)
        const cartId = cart.data.cart.cartId
        const line = await api.post("/store/garmops/cart-lines", { cartId, projectId: designA.data.project.id, versionId: designA.data.version.id, quantity: 50, sizes: { S: 10, M: 20, L: 20 } }, { headers: customerA })
        expect(line.status).toBe(201)
        expect(line.data.cart.lines).toHaveLength(1)
        expect(line.data.cart.lines[0].pricing.unitPricePaise).toBeGreaterThan(0)

        const designB = await api.post("/store/garmops/designs", { title: "Cart B", productSlug: "regular-fit-tee-200gsm", quantity: 50, configuration: { colourType: "signature", artwork: {}, neckLabel: { labelType: "standard-size" }, deliveryType: "standard" } }, { headers: customerA })
        const second = await api.post("/store/garmops/cart-lines", { cartId, projectId: designB.data.project.id, versionId: designB.data.version.id, quantity: 50, sizes: { S: 50 } }, { headers: customerA })
        expect(second.status).toBe(201)
        expect(second.data.cart.lines).toHaveLength(2)

        const invalidCart = await api.post("/store/garmops/cart", { cartType: "configured" }, { headers: customerA })
        const invalidLine = await api.post("/store/garmops/cart-lines", { cartId: invalidCart.data.cart.cartId, projectId: designA.data.project.id, versionId: designA.data.version.id, quantity: 10, sizes: { S: 10 } }, { headers: customerA })
        expect(invalidLine.status).toBe(400)

        const sample = await api.post("/store/garmops/sample-cart", { productSlug: "regular-fit-tee-200gsm", size: "M", quantity: 2 }, { headers: customerA })
        expect(sample.status).toBe(201)
        expect(sample.data.cart.cartType).toBe("sample")
        expect(sample.data.cart.lines).toHaveLength(1)

        const customerB = await customer(`cart-b-${Date.now()}@example.test`)
        const idor = await api.get(`/store/garmops/cart/${cartId}`, { headers: customerB })
        expect(idor.status).toBe(404)
        const crossCart = await api.post("/store/garmops/cart-lines", { cartId, projectId: designA.data.project.id, versionId: designA.data.version.id, quantity: 50, sizes: { S: 50 } }, { headers: customerB })
        expect(crossCart.status).toBe(400)
      })

      it("completes a verified PayU checkout into one order and one invoice", async () => {
        const email = `payment-${Date.now()}@example.test`
        const requested = await api.post("/store/garmops/otp/request", { email })
        const auth = await api.post("/auth/customer/emailotp", { email, challengeId: requested.data.challengeId, code: requested.data.testCode })
        const headers = { Authorization: `Bearer ${auth.data.token}` }
        const design = await api.post("/store/garmops/designs", { title: "Payment order", productSlug: "regular-fit-tee-200gsm", quantity: 50, configuration: { colourType: "signature", artwork: {}, neckLabel: { labelType: "standard-size" }, deliveryType: "standard" } }, { headers })
        const cart = await api.post("/store/garmops/cart", { cartType: "configured", email }, { headers })
        const cartId = cart.data.cart.cartId
        await api.post("/store/garmops/cart-lines", { cartId, projectId: design.data.project.id, versionId: design.data.version.id, quantity: 50, sizes: { S: 10, M: 20, L: 20 } }, { headers })
        const checkout = await api.post("/store/garmops/checkout/prepare", { cartId, email, termsVersion: "terms-2026-08", privacyVersion: "privacy-2026-08", shippingAddress: { first_name: "Test", last_name: "Customer", address_1: "1 Test Street", city: "Bengaluru", province: "Karnataka", postal_code: "560001", country_code: "in", phone: "9999999999" } }, { headers })
        expect(checkout.status).toBe(200)
        const initiated = await api.post("/store/garmops/payments/payu/initiate", { cartId }, { headers })
        expect(initiated.status).toBe(201)
        const sessionData = initiated.data.paymentSession.data ?? {}
        const fields = sessionData.fields ?? sessionData
        const response = { key: fields.key, txnid: fields.txnid, amount: fields.amount, productinfo: fields.productinfo, firstname: fields.firstname, email: fields.email, udf1: fields.udf1, udf5: fields.udf5, status: "success", mihpayid: `mih-${Date.now()}` }
        const responseParts = [process.env.PAYU_SALT ?? "stage2-test-salt", response.status, "", "", "", "", "", response.udf5 ?? "", "", "", "", response.udf1 ?? "", response.email, response.firstname, response.productinfo, response.amount, response.txnid, response.key]
        const callback = await api.post("/store/garmops/payments/payu/callback", { ...response, hash: createHash("sha512").update(responseParts.join("|")).digest("hex") })
        expect([200, 202]).toContain(callback.status)
        const duplicate = await api.post("/store/garmops/payments/payu/webhook", { ...response, hash: createHash("sha512").update(responseParts.join("|")).digest("hex") })
        expect([200, 202]).toContain(duplicate.status)
        const orders = await api.get("/store/garmops/orders", { headers })
        expect(orders.status).toBe(200)
        expect(orders.data.orders).toHaveLength(1)
        expect(orders.data.orders[0].publicOrderNumber).toMatch(/^GAR-\d{4}-\d{6}$/)
        expect(orders.data.orders[0].invoice).toMatchObject({ status: "issued", downloadable: true })
        const status = await api.get(`/store/garmops/payments/payu/status?cartId=${encodeURIComponent(cartId)}`, { headers })
        expect(status.status).toBe(200)
        expect(status.data.status).toBe("order_complete")
      })

      it("completes a sample checkout with validation, order numbering, and invoice artifacts", async () => {
        const headers = await customer(`sample-payment-${Date.now()}@example.test`)
        const cart = await api.post("/store/garmops/sample-cart", { productSlug: "regular-fit-tee-200gsm", size: "M", quantity: 2 }, { headers })
        expect(cart.status).toBe(201)
        const cartId = cart.data.cart.cartId
        const validation = await api.post("/store/garmops/sample-cart/validate", { cartId }, { headers })
        expect(validation.status).toBe(200)
        expect(validation.data.valid).toBe(true)
        const checkout = await api.post("/store/garmops/checkout/prepare", { cartId, email: "sample-checkout@example.test", termsVersion: "terms-2026-08", privacyVersion: "privacy-2026-08", shippingAddress: { first_name: "Sample", address_1: "1 Test Street", city: "Bengaluru", province: "Karnataka", postal_code: "560001", country_code: "in" } }, { headers })
        expect(checkout.status).toBe(200)
        const initiated = await api.post("/store/garmops/payments/payu/initiate", { cartId }, { headers })
        expect(initiated.status).toBe(201)
        const callback = await api.post("/store/garmops/payments/payu/callback", payuResponse(initiated.data.paymentSession, cartId))
        expect([200, 202]).toContain(callback.status)
        const orders = await api.get("/store/garmops/orders", { headers })
        expect(orders.status).toBe(200)
        expect(orders.data.orders).toHaveLength(1)
        expect(orders.data.orders[0].publicOrderNumber).toMatch(/^SAM-\d{4}-\d{6}$/)
        expect(orders.data.orders[0].invoice).toMatchObject({ status: "issued", downloadable: true })
      })

      it("rejects an MOQ-bypassing line update while preserving valid checkout", async () => {
        const headers = await customer(`moq-${Date.now()}@example.test`)
        const design = await api.post("/store/garmops/designs", { title: "MOQ E2E", productSlug: "regular-fit-tee-200gsm", quantity: 50, configuration: { colourType: "signature", artwork: {}, neckLabel: { labelType: "standard-size" }, deliveryType: "standard" } }, { headers })
        const cart = await api.post("/store/garmops/cart", { cartType: "configured" }, { headers })
        const line = await api.post("/store/garmops/cart-lines", { cartId: cart.data.cart.cartId, projectId: design.data.project.id, versionId: design.data.version.id, quantity: 50, sizes: { S: 50 } }, { headers })
        expect(line.status).toBe(201)
        const update = await api.patch(`/store/garmops/cart-lines/${line.data.cart.lines[0].id}`, { quantity: 10, sizes: { S: 10 } }, { headers })
        expect(update.status).toBe(400)
        expect(update.data.code).toBe("INVALID_CONFIGURED_LINE")
        const checkout = await api.post("/store/garmops/checkout/prepare", { cartId: cart.data.cart.cartId, email: "moq@example.test", termsVersion: "terms-2026-08", shippingAddress: { first_name: "MOQ", address_1: "1 Test Street", city: "Bengaluru", province: "Karnataka", postal_code: "560001", country_code: "in" } }, { headers })
        expect(checkout.status).toBe(200)
      })

      it("keeps concurrent callback and webhook delivery idempotent", async () => {
        const headers = await customer(`race-${Date.now()}@example.test`)
        const payment = await api.post("/store/garmops/cart", { cartType: "sample" }, { headers })
        expect(payment.status).toBe(201)
        const cartId = payment.data.cart.cartId
        await api.post("/store/garmops/sample-cart", { cartId, productSlug: "regular-fit-tee-200gsm", size: "S", quantity: 1 }, { headers })
        const checkout = await api.post("/store/garmops/checkout/prepare", { cartId, email: "race@example.test", termsVersion: "terms-2026-08", shippingAddress: { first_name: "Race", address_1: "1 Test Street", city: "Bengaluru", province: "Karnataka", postal_code: "560001", country_code: "in" } }, { headers })
        expect(checkout.status).toBe(200)
        const initiated = await api.post("/store/garmops/payments/payu/initiate", { cartId }, { headers })
        const response = payuResponse(initiated.data.paymentSession, cartId)
        const [callback, webhook] = await Promise.all([
          api.post("/store/garmops/payments/payu/callback", response),
          api.post("/store/garmops/payments/payu/webhook", response),
        ])
        expect([200, 202]).toContain(callback.status)
        expect([200, 202]).toContain(webhook.status)
        const orders = await api.get("/store/garmops/orders", { headers })
        expect(orders.data.orders).toHaveLength(1)
      })

      it("executes Founder Foundry access and enforces Operations permissions", async () => {
        const customerHeaders = await customer(`foundry-${Date.now()}@example.test`)
        const paid = await paidCart(customerHeaders, "configured")
        const founderHeaders = await staff("founder")
        const operationsHeaders = await staff("operations")
        const session = await api.get("/foundry/session", { headers: founderHeaders })
        expect(session.status).toBe(200)
        expect(session.data.staff.role).toBe("founder")
        const staffView = await api.get("/foundry/staff", { headers: operationsHeaders })
        expect(staffView.status).toBe(200)
        const foundryOrders = await api.get("/foundry/orders", { headers: operationsHeaders })
        expect(foundryOrders.status).toBe(200)
        expect(foundryOrders.data.orders).toEqual(expect.arrayContaining([expect.objectContaining({ id: expect.any(String), order_id: expect.any(String) })]))
        const job = foundryOrders.data.orders.find((candidate: { order_id: string }) => candidate.order_id === paid.order)
        expect(job).toBeTruthy()
        const detail = await api.get(`/foundry/orders/${job.id}`, { headers: operationsHeaders })
        expect(detail.status).toBe(200)
        expect(detail.data.order.payment).toEqual({ id: expect.stringMatching(/^pay_/) })
        expect(detail.data.order.payment_collections).toBeUndefined()
        const transition = await api.post(`/foundry/orders/${job.id}/status`, { status: "order_review", reason: "E2E review" }, { headers: operationsHeaders })
        expect(transition.status).toBe(200)
        const refund = await api.post(`/foundry/payments/${detail.data.order.payment.id}/refund`, { idempotencyKey: `refund-${Date.now()}` }, { headers: founderHeaders })
        expect(refund.status).toBe(201)
        expect(refund.data.refund.status).toBe("submitted")
        const operationsRefund = await api.post(`/foundry/payments/${detail.data.order.payment.id}/refund`, { idempotencyKey: `operations-refund-${Date.now()}` }, { headers: operationsHeaders })
        expect(operationsRefund.status).toBe(403)
        const customerRefund = await api.post(`/foundry/payments/${detail.data.order.payment.id}/refund`, { idempotencyKey: `customer-refund-${Date.now()}` }, { headers: customerHeaders })
        expect(customerRefund.status).toBe(401)
        const founderProvisioning = await api.post("/foundry/staff", {}, { headers: founderHeaders })
        expect(founderProvisioning.status).toBe(405)
        const operationsProvisioning = await api.post("/foundry/staff", {}, { headers: operationsHeaders })
        expect(operationsProvisioning.status).toBe(403)
        const operationsPayment = await api.get("/foundry/payments/not-authorized", { headers: operationsHeaders })
        expect(operationsPayment.status).toBe(403)
      })
    })
  },
})
