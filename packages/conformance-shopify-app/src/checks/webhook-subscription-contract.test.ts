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

const events = (subscription: string, header = 'api_version = "unstable"') =>
  `[events]\n${header}\n\n[[events.subscription]]\n${subscription}`;
const priceSync =
  'handle = "price_sync"\ntopic = "Product"\nactions = ["update"]\ntriggers = ["product.variants.price"]\nuri = "/api/events"\nquery = "query { shop { id } }"\nquery_filter = "product.status:\'ACTIVE\'"';

it("ignores the [events] block unless Events validation is opted in", async () => {
  const root = await createFixture({ "shopify.app.toml": events('topic = "products/update"') });
  expect(await webhookSubscriptionContract.run({ root })).toEqual([]);
  expect(await webhookSubscriptionContract.run({ root, nextGenerationEvents: false })).toEqual([]);
});

it.each([
  priceSync,
  'handle = "product-lifecycle"\ntopic = "Product"\nactions = ["create", "delete"]\nuri = "https://app.example/events"',
  'handle = "pubsub"\ntopic = "Customer"\nactions = ["create"]\nuri = "pubsub://project-id:topic-id"',
])("accepts a documented Events subscription", async (subscription) => {
  const root = await createFixture({ "shopify.app.toml": events(subscription) });
  expect(await webhookSubscriptionContract.run({ root, nextGenerationEvents: true })).toEqual([]);
});

it.each([
  ["events.api_version", events(priceSync, "")],
  ["events.subscription[0].handle", events(priceSync.replace('"price_sync"', '"price sync"'))],
  ["events.subscription[0].topic", events(priceSync.replace('"Product"', '"products/update"'))],
  ["events.subscription[0].actions", events(priceSync.replace('["update"]', '["upsert"]'))],
  ["events.subscription[0].triggers", events(priceSync.replace('triggers = ["product.variants.price"]\n', ""))],
  ["events.subscription[0].triggers", events(priceSync.replace('["product.variants.price"]', "[]"))],
  ["events.subscription[0].uri", events(priceSync.replace('"/api/events"', '"http://app.example/events"'))],
  ["events.subscription[0].query_filter", events(priceSync.replace('query = "query { shop { id } }"\n', ""))],
  ["events.subscription", '[events]\napi_version = "unstable"\n[events.subscription]\nhandle = "one"'],
])("reports %s", async (field, toml) => {
  const root = await createFixture({ "shopify.app.toml": toml });
  expect(await webhookSubscriptionContract.run({ root, nextGenerationEvents: true })).toEqual([
    expect.objectContaining({ severity: "error", message: expect.stringContaining(`shopify.app.toml ${field}:`) }),
  ]);
});

it("reports duplicate Events handles", async () => {
  const root = await createFixture({
    "shopify.app.toml": `${events(priceSync)}\n\n[[events.subscription]]\n${priceSync}`,
  });
  expect(await webhookSubscriptionContract.run({ root, nextGenerationEvents: true })).toEqual([
    expect.objectContaining({ message: expect.stringContaining("already used") }),
  ]);
});
