import { ResendNotificationProvider } from "../index"

describe("Resend notification provider", () => {
  afterEach(() => jest.restoreAllMocks())

  it("sends rendered email content with configured credentials", async () => {
    const request = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))
    const provider = new ResendNotificationProvider({}, { apiKey: "re_test", from: "Garmops <login@example.com>" })

    await expect(provider.send({
      to: "customer@example.com",
      channel: "email",
      template: "garmops-login-otp",
      content: { subject: "Your code", text: "123456" },
    })).resolves.toEqual({ id: "email-1" })

    expect(request).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer re_test" }),
    }))
    const body = JSON.parse(String((request.mock.calls[0]?.[1] as RequestInit).body))
    expect(body).toMatchObject({
      from: "Garmops <login@example.com>",
      to: "customer@example.com",
      subject: "Your code",
      text: "123456",
    })
  })
})
