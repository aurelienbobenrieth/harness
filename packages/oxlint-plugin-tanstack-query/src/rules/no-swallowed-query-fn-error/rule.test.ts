import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "tanstack-query/no-swallowed-query-fn-error";
const imports = 'import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";\n';

it("reports a queryFn that catches and logs without rethrowing", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const todos = queryOptions({
  queryKey: ["todos"],
  queryFn: async () => {
    try {
      return await api.getTodos();
    } catch (error) {
      console.error(error);
    }
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports a fallback assigned through an outer variable", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const useTodos = () =>
  useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      let todos = [];
      try {
        todos = await api.getTodos();
      } catch {}
      return todos;
    },
  });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports a returned promise chain that resolves from .catch()", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const todos = queryOptions({ queryKey: ["todos"], queryFn: () => api.getTodos().catch(() => []) });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("reports a mutationFn that swallows its failure", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}export const useSave = () =>
  useMutation({
    mutationFn: async (todo: unknown) => {
      try {
        return await api.save(todo);
      } catch (error) {
        return null;
      }
    },
  });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("resolves a same-file function reference one hop", async () => {
  await expect(
    assertRuleReports(
      ruleName,
      `${imports}async function fetchTodos() {
  try {
    return await api.getTodos();
  } catch (error) {
    report(error);
  }
}
export const todos = queryOptions({ queryKey: ["todos"], queryFn: fetchTodos });\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts a conditional rethrow", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const todo = queryOptions({
  queryKey: ["todo"],
  queryFn: async () => {
    try {
      return await api.getTodo();
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("accepts a rejected promise returned from the catch block and a rethrowing .catch()", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const a = queryOptions({
  queryKey: ["a"],
  queryFn: async () => {
    try {
      return await api.a();
    } catch (error) {
      return Promise.reject(new ApiError(error));
    }
  },
});
export const b = queryOptions({
  queryKey: ["b"],
  queryFn: () =>
    api.b().catch((error: unknown) => {
      throw new ApiError(error);
    }),
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores a guarded side effect that does not decide the result", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const todos = queryOptions({
  queryKey: ["todos"],
  queryFn: async () => {
    try {
      analytics.track("todos");
    } catch {}
    void prefetch().catch(() => {});
    return api.getTodos();
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores a swallowing catch inside a nested callback", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `${imports}export const todos = queryOptions({
  queryKey: ["todos"],
  queryFn: async () => {
    const todos = await api.getTodos();
    return todos.map((todo) => {
      try {
        return decode(todo);
      } catch {
        return todo;
      }
    });
  },
});\n`,
    ),
  ).resolves.toBeUndefined();
});

it("ignores queryFn properties in files that do not import TanStack Query", async () => {
  await expect(
    assertRuleDoesNotReport(
      ruleName,
      `export const config = {
  queryFn: async () => {
    try {
      return await api.getTodos();
    } catch (error) {
      console.error(error);
    }
  },
};\n`,
    ),
  ).resolves.toBeUndefined();
});
