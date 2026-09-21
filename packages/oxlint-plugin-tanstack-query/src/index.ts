import { eslintCompatPlugin } from "@oxlint/plugins";
import { noQueryCacheMutation } from "./rules/no-query-cache-mutation/rule.js";
import { noQueryDataInUseState } from "./rules/no-query-data-in-use-state/rule.js";
import { noQueryDataSyncEffect } from "./rules/no-query-data-sync-effect/rule.js";
import { noSwallowedQueryFnError } from "./rules/no-swallowed-query-fn-error/rule.js";
import { queryFnReturnsValue } from "./rules/query-fn-returns-value/rule.js";
import { requireFetchStatusCheckInQueryFn } from "./rules/require-fetch-status-check-in-query-fn/rule.js";
import { requireOptimisticUpdateGuards } from "./rules/require-optimistic-update-guards/rule.js";
import { testQueryClientHygiene } from "./rules/test-query-client-hygiene/rule.js";

export default eslintCompatPlugin({
  meta: {
    name: "tanstack-query",
  },
  rules: {
    "no-query-cache-mutation": noQueryCacheMutation,
    "no-query-data-in-use-state": noQueryDataInUseState,
    "no-query-data-sync-effect": noQueryDataSyncEffect,
    "no-swallowed-query-fn-error": noSwallowedQueryFnError,
    "query-fn-returns-value": queryFnReturnsValue,
    "require-fetch-status-check-in-query-fn": requireFetchStatusCheckInQueryFn,
    "require-optimistic-update-guards": requireOptimisticUpdateGuards,
    "test-query-client-hygiene": testQueryClientHygiene,
  },
});
