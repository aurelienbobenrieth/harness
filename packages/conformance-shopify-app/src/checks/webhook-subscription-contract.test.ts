import { expect, it } from "vitest";
import { webhookSubscriptionContract } from "./webhook-subscription-contract.js";
import { createFixture } from "./test-support.js";

it.each([
  "https://app.example/webhooks",
  "/webhooks?region=eu",
  "pubsub://project-id:topic-id",
  "arn:aws:events:us-east-1::event-source/aws.partner/shopify.com/123/reviews",
])("accepts documented transport %s", async (uri) => {
  const root = await createFixture({
    "shopify.app.toml": `[[webhooks.subscriptions]]\ntopics = ["orders/create"]\nuri = ${JSON.stringify(uri)}`,
  });
  expect(await webhookSubscriptionContract.run({ root })).toEqual([]);
});

it.each([
  "http://app.example",
  "//app.example/webhooks",
  "/webhooks#lost",
  "https://app.example/#lost",
  "pubsub://project/topic",
  "pubsub://project:",
  "arn:aws:s3:bucket",
  "not-a-url",
  "https://user:secret@app.example",
])("rejects a non-deliverable or insecure destination %s", async (uri) => {
  const root = await createFixture({
    "shopify.app.toml": `[[webhooks.subscriptions]]\ntopics = ["orders/create"]\nuri = ${JSON.stringify(uri)}`,
  });
  const findings = await webhookSubscriptionContract.run({ root });
  expect(findings).toHaveLength(1);
  expect(JSON.stringify(findings)).not.toContain("secret");
});

it.each([
  'topics = "orders/create"',
  "topics = []",
  'topics = [""]',
  'compliance_topics = ["orders/create"]',
  'description = "orders/create"',
])("rejects unusable subscription topic declarations", async (topics) => {
  const root = await createFixture({
    "shopify.app.toml": `[[webhooks.subscriptions]]\n${topics}\nuri = "/webhooks"`,
  });
  expect(await webhookSubscriptionContract.run({ root })).toHaveLength(1);
});

it("does not confuse nested names with actual webhook subscriptions", async () => {
  const root = await createFixture({
    "shopify.app.toml":
      '[unrelated]\nsubscriptions = "ignored"\n[[webhooks.subscriptions]]\ncompliance_topics = ["shop/redact"]\nuri = "/privacy"',
  });
  expect(await webhookSubscriptionContract.run({ root })).toEqual([]);
});

it("rejects a subscription table masquerading as the array contract", async () => {
  const root = await createFixture({
    "shopify.app.toml": '[webhooks.subscriptions]\ntopics = ["orders/create"]\nuri = "/webhooks"',
  });
  expect(await webhookSubscriptionContract.run({ root })).toHaveLength(1);
});
